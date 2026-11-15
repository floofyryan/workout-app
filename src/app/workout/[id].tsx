import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/Sheets';
import { supersetColors } from '@/components/WorkoutEditor';
import { Card, IconButton, Stat } from '@/components/ui';
import { workoutVolume } from '@/components/WorkoutCard';
import { MonsterSprite } from '@/components/RpgSprites';
import { deleteWorkout, getRecordsBefore, getStatEntries, getWorkout, saveTemplate } from '@/db/repo';
import { computeRecords, estimate1RM, newRecords, RECORD_LABELS, type RecordKey } from '@/lib/calc';
import { formatDate, formatDuration, formatNumber, formatTime } from '@/lib/format';
import { useFocusQuery } from '@/lib/hooks';
import { achievementsFrom, characterFrom, gearTier, GEAR_TIERS, STAT_INFO, STATS, type Stat as Attribute } from '@/lib/rpg';
import { formatSet, SET_TYPE_LABEL } from '@/lib/setFormat';
import { colors, radius, spacing } from '@/lib/theme';
import { exerciseCategory, type Template, type WorkoutDetail } from '@/lib/types';
import { formatWeight, kgToDisplay, weightUnit } from '@/lib/units';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';
import { useSettings } from '@/state/SettingsContext';

interface QuestReward {
  xp: number;
  slain: number;
  levelBefore: number;
  levelAfter: number;
  title: string;
  gains: { stat: Attribute; to: number }[];
  /** Achievements this workout unlocked. */
  unlocked: string[];
  /** New gear when the level-up reached a new tier. */
  newGear: string | null;
}

/** XP, kills, level-ups and attribute gains from one workout, against everything done before it. */
async function questReward(db: Parameters<typeof getStatEntries>[0], w: WorkoutDetail): Promise<QuestReward> {
  const before = await getStatEntries(db, w.startedAt);
  const own = w.exercises.flatMap((e) =>
    e.sets.map((set) => ({
      type: e.exercise.type,
      bodyPart: e.exercise.bodyPart,
      category: e.exercise.category,
      set,
      workoutId: w.id,
      startedAt: w.startedAt,
    })),
  );
  const had = new Set(achievementsFrom(before).filter((x) => x.unlocked).map((x) => x.id));
  const a = characterFrom(before);
  const b = characterFrom([...before, ...own]);
  return {
    xp: b.xp - a.xp,
    slain: b.slain - a.slain,
    levelBefore: a.level.level,
    levelAfter: b.level.level,
    title: b.title,
    gains: STATS.filter((s) => b.stats[s].value > a.stats[s].value).map((stat) => ({ stat, to: b.stats[stat].value })),
    unlocked: achievementsFrom([...before, ...own])
      .filter((x) => x.unlocked && !had.has(x.id))
      .map((x) => x.name),
    newGear:
      gearTier(b.level.level) > gearTier(a.level.level) ? GEAR_TIERS[gearTier(b.level.level)].weapon : null,
  };
}

/** Converts a finished workout into an unsaved template (for "repeat" and "save as template"). */
function asTemplate(w: WorkoutDetail): Omit<Template, 'id' | 'lastUsedAt'> {
  return {
    name: w.name,
    notes: '',
    // A workout made up only of stretches becomes a stretch routine.
    kind: w.exercises.length > 0 && w.exercises.every((e) => exerciseCategory(e.exercise) === 'stretching') ? 'stretch' : 'workout',
    folder: null,
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exercise.id,
      restSeconds: null,
      notes: e.notes,
      sets: e.sets,
      supersetGroup: e.supersetGroup,
    })),
  };
}

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const { id, summary } = useLocalSearchParams<{ id: string; summary?: string }>();
  const { settings } = useSettings();
  const active = useActiveWorkout();
  const [menu, setMenu] = useState(false);
  const [data] = useFocusQuery(
    async (db) => {
      const workout = await getWorkout(db, Number(id));
      const prs = new Map<number, RecordKey[]>();
      if (workout) {
        for (const e of workout.exercises) {
          const before = await getRecordsBefore(db, e.exercise, workout.startedAt);
          prs.set(e.id, newRecords(e.exercise.type, before, computeRecords(e.exercise.type, e.sets)));
        }
      }
      const reward = workout && settings.adventureMode ? await questReward(db, workout) : null;
      return { workout, prs, reward };
    },
    [id, settings.adventureMode],
  );
  const w = data?.workout;
  const units = settings.units;

  if (data && !w) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Workout not found.</Text>
      </View>
    );
  }
  if (!w || !data) return null;

  const supersetColorList = supersetColors(w.exercises.map((e) => ({ supersetId: e.supersetGroup ? String(e.supersetGroup) : null })));
  const totalPrs = [...data.prs.values()].reduce((n, l) => n + l.length, 0);
  const volume = workoutVolume(w);

  const repeat = () => {
    const go = () => {
      active.start({ ...asTemplate(w), id: -1, lastUsedAt: null });
      // A repeated workout isn't tied to a template.
      active.update((cur) => ({ ...cur, templateId: null }));
      router.push('/active-workout');
    };
    if (active.workout) {
      Alert.alert('Workout in progress', 'Discard the current workout and start this one?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard & start', style: 'destructive', onPress: go },
      ]);
    } else go();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: summary ? 'Workout Complete' : 'Workout',
          headerRight: () => <IconButton name="ellipsis-horizontal" color={colors.primary} onPress={() => setMenu(true)} />,
        }}
      />
      {summary && !data.reward && (
        <View style={styles.banner}>
          <Ionicons name="trophy" size={28} color={colors.warning} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.bannerTitle}>Nice work!</Text>
            <Text style={styles.bannerText}>
              {totalPrs > 0 ? `You set ${totalPrs} personal record${totalPrs === 1 ? '' : 's'}.` : 'Workout saved.'}
            </Text>
          </View>
        </View>
      )}
      {data.reward && <QuestRewardCard reward={data.reward} summary={!!summary} prs={totalPrs} />}
      <Text style={styles.title}>{w.name}</Text>
      <Text style={styles.muted}>
        {formatDate(w.startedAt)} · {formatTime(w.startedAt)} – {formatTime(w.endedAt)}
      </Text>
      {w.notes ? <Text style={[styles.text, { marginTop: spacing.sm }]}>{w.notes}</Text> : null}

      <Card style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        <Stat label="Duration" value={formatDuration((w.endedAt - w.startedAt) / 1000)} />
        <Stat label={`Volume (${weightUnit(units)})`} value={formatNumber(kgToDisplay(volume, units))} />
        <Stat label="PRs" value={String(totalPrs)} />
      </Card>

      {w.exercises.map((e, index) => {
        const prs = data.prs.get(e.id) ?? [];
        const supersetColor = supersetColorList[index];
        const supersetStart = supersetColor != null && w.exercises[index - 1]?.supersetGroup !== e.supersetGroup;
        let n = 0;
        const showE1rm = e.exercise.type === 'weight_reps' || e.exercise.type === 'weighted_bodyweight';
        return (
          <Card
            key={e.id}
            style={[{ marginTop: spacing.md }, supersetColor ? { borderLeftWidth: 4, borderLeftColor: supersetColor } : null]}
          >
            {supersetStart ? <Text style={[styles.supersetTag, { color: supersetColor! }]}>SUPERSET</Text> : null}
            <Pressable onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: String(e.exercise.id) } })}>
              <Text style={styles.exName}>{e.exercise.name}</Text>
            </Pressable>
            {e.notes ? <Text style={styles.note}>{e.notes}</Text> : null}
            {e.sets.map((s, i) => (
              <View key={i} style={styles.setLine}>
                <Text style={[styles.setNo, s.setType !== 'normal' && { color: colors.warning }]}>
                  {s.setType === 'normal' ? ++n : SET_TYPE_LABEL[s.setType]}
                </Text>
                <Text style={[styles.text, { flex: 1 }]}>{formatSet(e.exercise.type, s, units)}</Text>
                {s.rpe ? <Text style={[styles.muted, { marginRight: spacing.md }]}>@{s.rpe}</Text> : null}
                {showE1rm && s.weight && s.reps ? (
                  <Text style={styles.muted}>{formatWeight(estimate1RM(s.weight, s.reps), units)}</Text>
                ) : null}
              </View>
            ))}
            {prs.length > 0 && (
              <View style={styles.prRow}>
                {prs.map((k) => (
                  <View key={k} style={styles.prChip}>
                    <Ionicons name="trophy" size={12} color={colors.warning} />
                    <Text style={styles.prText}>{RECORD_LABELS[k]}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={w.name}
        actions={[
          { label: 'Repeat workout', icon: 'repeat', onPress: repeat },
          {
            label: 'Edit workout',
            icon: 'create-outline',
            onPress: () => router.push({ pathname: '/workout-edit/[id]', params: { id: String(w.id) } }),
          },
          {
            label: 'Save as template',
            icon: 'bookmark-outline',
            onPress: async () => {
              const tid = await saveTemplate(db, null, asTemplate(w));
              router.push({ pathname: '/template/[id]', params: { id: String(tid) } });
            },
          },
          {
            label: 'Delete workout',
            icon: 'trash-outline',
            destructive: true,
            onPress: () =>
              Alert.alert('Delete workout?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteWorkout(db, w.id);
                    router.back();
                  },
                },
              ]),
          },
        ]}
      />
    </ScrollView>
  );
}

function QuestRewardCard({ reward: r, summary, prs }: { reward: QuestReward; summary: boolean; prs: number }) {
  const levelUp = r.levelAfter > r.levelBefore;
  return (
    <View style={styles.quest}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MonsterSprite kind={levelUp ? 'dragon' : 'goblin'} elite size={56} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={styles.questKicker}>{summary ? 'Dungeon cleared' : 'Quest log'}</Text>
          <Text style={styles.bannerTitle}>
            +{r.xp} XP · {r.slain} monster{r.slain === 1 ? '' : 's'} slain
          </Text>
          {prs > 0 ? (
            <Text style={styles.bannerText}>
              {prs} personal record{prs === 1 ? '' : 's'} — legendary loot!
            </Text>
          ) : null}
        </View>
      </View>
      {levelUp && (
        <View style={styles.levelUp}>
          <Ionicons name="arrow-up-circle" size={18} color={colors.warning} />
          <Text style={styles.levelUpText}>
            Level up! {r.levelBefore} → {r.levelAfter} · {r.title}
            {r.newGear ? `\nNew gear: ${r.newGear}` : ''}
          </Text>
        </View>
      )}
      {r.unlocked.map((name) => (
        <View key={name} style={styles.levelUp}>
          <Ionicons name="medal" size={18} color={colors.warning} />
          <Text style={styles.levelUpText}>Achievement unlocked: {name}</Text>
        </View>
      ))}
      {r.gains.length > 0 && (
        <View style={styles.prRow}>
          {r.gains.map((g) => (
            <View key={g.stat} style={[styles.prChip, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[styles.prText, { color: STAT_INFO[g.stat].color }]}>
                {g.stat} ↑ {g.to}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quest: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  questKicker: { color: colors.warning, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  levelUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  levelUpText: { color: colors.text, fontWeight: '700', flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerTitle: { color: colors.text, fontWeight: '700', fontSize: 18 },
  bannerText: { color: colors.muted, marginTop: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14, marginTop: 2 },
  supersetTag: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  exName: { color: colors.primary, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  note: { color: colors.warning, fontSize: 13, marginBottom: spacing.xs },
  setLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  setNo: { color: colors.muted, width: 24, fontWeight: '700' },
  prRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
});
