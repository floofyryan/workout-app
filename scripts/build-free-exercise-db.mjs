#!/usr/bin/env node
// Downloads free-exercise-db (https://github.com/yuhonas/free-exercise-db, public domain / Unlicense)
// and writes the trimmed copy bundled with the app to src/data/freeExerciseDb.json.
//
// Usage: node scripts/build-free-exercise-db.mjs [path/to/exercises.json]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'freeExerciseDb.json');

const input = process.argv[2]
  ? JSON.parse(readFileSync(process.argv[2], 'utf8'))
  : await (await fetch(SOURCE)).json();

const trimmed = input
  .map((e) => ({
    id: e.id,
    name: e.name.trim(),
    equipment: e.equipment ?? null,
    category: e.category,
    level: e.level,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: e.instructions.map((s) => s.trim()).filter(Boolean),
    images: e.images,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(OUT, JSON.stringify(trimmed) + '\n');
console.log(`Wrote ${trimmed.length} exercises to ${OUT}`);
