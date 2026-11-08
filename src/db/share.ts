// Sharing templates and programs as files. Exercises go by name, with enough about them to create
// any the other person doesn't have. Weights are left out: they're personal, and the first session
// (or a progression rule) fills them in.
import type { SQLiteDatabase } from 'expo-sqlite';

import { guessExercise } from '../lib/exerciseGuess';
import { parseProgression } from '../lib/progression';
import {
  BODY_PARTS,
  EQUIPMENT,
  EXERCISE_TYPES,
  SET_TYPES,
  TEMPLATE_KINDS,
  type BodyPart,
  type Equipment,
  type ExerciseType,
  type Progression,
  type SetData,
  type Template,
  type TemplateExercise,
  type TemplateKind,
} from '../lib/types';
import {
  createExercise,
  createProgram,
  getExercisesByIds,
  getProgram,
  getTemplate,
  insertTemplate,
  listExercises,
  setProgramBlock,
} from './repo';

const APP = 'workout-app';
const NOT_SHARED = "That isn't a template or program shared from this app.";

interface SharedExercise {
  name: string;
  equipment: Equipment;
  bodyPart: BodyPart;
  type: ExerciseType;
  restSeconds: number | null;
  notes: string;
  sets: SetData[];
  supersetGroup: number | null;
  progression: Progression | null;
}

interface SharedTemplate {
  name: string;
  notes: string;
  kind: TemplateKind;
  exercises: SharedExercise[];
}

export interface SharedFile {
  app: typeof APP;
  format: 'template' | 'program';
  version: 1;
  program?: { name: string; notes: string; blockWeeks?: number | null };
  templates: SharedTemplate[];
}

// ---------- Export ----------

/** A rule without its personal state (misses so far). */
function freshRule(p: Progression): Progression {
  return p.kind === 'linear' ? { ...p, misses: 0 } : p;
}

async function sharedTemplates(db: SQLiteDatabase, templates: Template[]): Promise<SharedTemplate[]> {
  const exercises = await getExercisesByIds(db, templates.flatMap((t) => t.exercises.map((e) => e.exerciseId)));
  return templates.map((t) => ({
    name: t.name,
    notes: t.notes,
    kind: t.kind,
    exercises: t.exercises.flatMap((e) => {
      const ex = exercises.get(e.exerciseId);
      if (!ex) return [];
      return [
        {
          name: ex.name,
          equipment: ex.equipment,
          bodyPart: ex.bodyPart,
          type: ex.type,
          restSeconds: e.restSeconds,
          notes: e.notes,
          sets: e.sets.map((s) => ({ ...s, weight: null, rpe: null })),
          supersetGroup: e.supersetGroup ?? null,
          progression: e.progression ? freshRule(e.progression) : null,
        },
      ];
    }),
  }));
}

const toJson = (file: SharedFile) => JSON.stringify(file, null, 2);

export async function exportTemplate(db: SQLiteDatabase, id: number): Promise<string | null> {
  const t = await getTemplate(db, id);
  if (!t) return null;
  return toJson({ app: APP, format: 'template', version: 1, templates: await sharedTemplates(db, [t]) });
}

export async function exportProgram(db: SQLiteDatabase, id: number): Promise<string | null> {
  const p = await getProgram(db, id);
  if (!p) return null;
  return toJson({
    app: APP,
    format: 'program',
    version: 1,
    program: { name: p.name, notes: p.notes, blockWeeks: p.blockWeeks },
    templates: await sharedTemplates(db, p.templates),
  });
}

// ---------- Import ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);
function oneOf<T extends string>(options: readonly T[], v: unknown, fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function toSet(s: Record<string, unknown>): SetData {
  const reps = num(s.reps);
  return {
    setType: oneOf(SET_TYPES, s.setType, 'normal'),
    weight: num(s.weight),
    reps: reps == null ? null : Math.round(reps),
    durationS: num(s.durationS),
    distanceM: num(s.distanceM),
    rpe: num(s.rpe),
  };
}

/** Reads a shared file, checking every field. Throws a readable error for anything else. */
export function parseSharedFile(json: string): SharedFile {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error(NOT_SHARED);
  }
  if (!isObject(v) || v.app !== APP || (v.format !== 'template' && v.format !== 'program') || !Array.isArray(v.templates)) {
    throw new Error(NOT_SHARED);
  }
  const templates = list(v.templates).map((t) => ({
    name: text(t.name).trim() || 'Shared workout',
    notes: text(t.notes),
    kind: oneOf(TEMPLATE_KINDS, t.kind, 'workout'),
    exercises: list(t.exercises)
      .filter((e) => text(e.name).trim())
      .map((e): SharedExercise => {
        const name = text(e.name).trim();
        const sets = list(e.sets).map(toSet);
        const guess = guessExercise(name, sets);
        const rule = isObject(e.progression) ? parseProgression(JSON.stringify(e.progression)) : null;
        return {
          name,
          equipment: oneOf(EQUIPMENT, e.equipment, guess.equipment),
          bodyPart: oneOf(BODY_PARTS, e.bodyPart, guess.bodyPart),
          type: oneOf(EXERCISE_TYPES, e.type, guess.type),
          restSeconds: num(e.restSeconds),
          notes: text(e.notes),
          sets,
          supersetGroup: num(e.supersetGroup),
          progression: rule ? freshRule(rule) : null,
        };
      }),
  }));
  if (templates.length === 0) throw new Error('That file has no workouts in it.');
  const program = isObject(v.program) ? v.program : {};
  const weeks = num(program.blockWeeks);
  return {
    app: APP,
    format: v.format,
    version: 1,
    program:
      v.format === 'program'
        ? {
            name: text(program.name).trim() || 'Shared program',
            notes: text(program.notes),
            blockWeeks: weeks != null && weeks >= 2 && weeks <= 12 ? Math.round(weeks) : null,
          }
        : undefined,
    templates,
  };
}

export interface ShareImportResult {
  /** The new program, when a whole program was imported. */
  programId: number | null;
  name: string;
  templateIds: number[];
  exercisesCreated: number;
}

/** Adds a shared template or program, matching exercises by name and creating unknown ones. */
export async function importShared(db: SQLiteDatabase, json: string): Promise<ShareImportResult> {
  const file = parseSharedFile(json);
  const byName = new Map((await listExercises(db, true)).map((e) => [e.name.toLowerCase(), e.id]));
  const result: ShareImportResult = {
    programId: null,
    name: file.program?.name ?? file.templates[0].name,
    templateIds: [],
    exercisesCreated: 0,
  };
  await db.withTransactionAsync(async () => {
    if (file.program) {
      result.programId = await createProgram(db, file.program.name, file.program.notes);
      if (file.program.blockWeeks) await setProgramBlock(db, result.programId, file.program.blockWeeks);
    }
    for (const t of file.templates) {
      const exercises: TemplateExercise[] = [];
      for (const e of t.exercises) {
        let id = byName.get(e.name.toLowerCase());
        if (id == null) {
          id = await createExercise(db, {
            name: e.name,
            equipment: e.equipment,
            bodyPart: e.bodyPart,
            type: e.type,
            notes: '',
            restSeconds: null,
            category: null,
          });
          byName.set(e.name.toLowerCase(), id);
          result.exercisesCreated++;
        }
        const { restSeconds, notes, sets, supersetGroup, progression } = e;
        exercises.push({ exerciseId: id, restSeconds, notes, sets, supersetGroup, progression });
      }
      result.templateIds.push(
        await insertTemplate(db, { name: t.name, notes: t.notes, kind: t.kind, programId: result.programId, exercises }),
      );
    }
  });
  return result;
}
