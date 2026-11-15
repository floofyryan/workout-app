import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { ActiveWorkout } from '@/lib/activeWorkout';
import { formatClock } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { dungeonProgress, monsterFor, nextEncounter, setXp, type Monster, type StatSource } from '@/lib/rpg';
import { formatSet } from '@/lib/setFormat';
import { colors, radius, spacing } from '@/lib/theme';
import type { Exercise, SetData, UnitSystem } from '@/lib/types';
import { useActiveWorkout } from '@/state/ActiveWorkoutContext';
import { ChestSprite, HeroSprite, MonsterSprite } from './RpgSprites';

const UNKNOWN: StatSource = { type: 'weight_reps', bodyPart: 'Other', category: null };
const SPRITE = 76;

// Remembered while the app runs, so minimizing the workout keeps the panel as it was.
let collapsedMemo = false;

/** XP earned so far in a live workout. */
function sessionXp(w: ActiveWorkout, exercises: Map<number, Exercise>): number {
  let xp = 0;
  for (const e of w.exercises) {
    const type = exercises.get(e.exerciseId)?.type ?? 'weight_reps';
    for (const s of e.sets) if (s.completed) xp += setXp(type, s);
  }
  return xp;
}

/** What the set asks for, e.g. "100 kg × 5", using last time's numbers for blank fields. */
function targetText(ex: Exercise | undefined, set: SetData, prev: SetData | undefined, units: UnitSystem): string | null {
  if (!ex) return null;
  const s = {
    ...set,
    weight: set.weight ?? prev?.weight ?? null,
    reps: set.reps ?? prev?.reps ?? null,
    durationS: set.durationS ?? prev?.durationS ?? null,
    distanceM: set.distanceM ?? prev?.distanceM ?? null,
  };
  if (s.weight == null && s.reps == null && s.durationS == null && s.distanceM == null) return null;
  return formatSet(ex.type, s, units);
}

const article = (name: string) => (/^[AEIOU]/i.test(name) ? 'An' : 'A');

/**
 * Adventure mode on the live workout: the hero fights one monster per set. Ticking a set off
 * slays the monster in front of you; the dungeon guide says which exercise and set is next.
 */
export function DungeonBattle({ workout, units }: { workout: ActiveWorkout; units: UnitSystem }) {
  const { exercises, previous, restTimer, setTimer } = useActiveWorkout();
  const now = useNow(500);
  const [collapsed, setCollapsed] = useState(collapsedMemo);

  const encounter = nextEncounter(workout);
  const { done, total } = dungeonProgress(workout);
  const xp = useMemo(() => sessionXp(workout, exercises), [workout, exercises]);

  const current = encounter ? workout.exercises[encounter.exerciseIndex] : null;
  const currentEx = current ? exercises.get(current.exerciseId) : undefined;
  const monster: Monster | null = current
    ? monsterFor(currentEx ?? UNKNOWN, current.sets, encounter!.setIndex, previous.get(current.exerciseId))
    : null;

  // ---------- Animations ----------
  const [heroX] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const [monsterX] = useState(() => new Animated.Value(0));
  const [monsterOpacity] = useState(() => new Animated.Value(1));
  const [monsterScale] = useState(() => new Animated.Value(1));
  const [slash] = useState(() => new Animated.Value(0));
  const [xpFloat] = useState(() => new Animated.Value(0));
  const [dying, setDying] = useState<{ monster: Monster; xp: number } | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // Notice sets that were just ticked off and play the attack for the first of them.
  const prevCompleted = useRef<Set<string> | null>(null);
  const attackAnim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    const completed = new Set<string>();
    let slain: { monster: Monster; xp: number } | null = null;
    for (const e of workout.exercises) {
      e.sets.forEach((s, i) => {
        if (!s.completed) return;
        completed.add(s.key);
        if (prevCompleted.current && !prevCompleted.current.has(s.key)) {
          const ex = exercises.get(e.exerciseId);
          const gained = setXp(ex?.type ?? 'weight_reps', s);
          if (slain) slain.xp += gained;
          else slain = { monster: monsterFor(ex ?? UNKNOWN, e.sets, i, previous.get(e.exerciseId)), xp: gained };
        }
      });
    }
    prevCompleted.current = completed;
    if (!slain) return;

    setDying(slain);
    monsterOpacity.setValue(1);
    monsterScale.setValue(1);
    monsterX.setValue(0);
    xpFloat.setValue(0);
    const driver = { useNativeDriver: true };
    const attack = Animated.sequence([
      Animated.timing(heroX, { toValue: 46, duration: 160, easing: Easing.in(Easing.quad), ...driver }),
      Animated.parallel([
        Animated.timing(heroX, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), ...driver }),
        Animated.sequence([
          Animated.timing(slash, { toValue: 1, duration: 60, ...driver }),
          Animated.timing(slash, { toValue: 0, duration: 220, ...driver }),
        ]),
        Animated.sequence([
          Animated.timing(monsterX, { toValue: 8, duration: 50, ...driver }),
          Animated.timing(monsterX, { toValue: -6, duration: 50, ...driver }),
          Animated.timing(monsterX, { toValue: 4, duration: 50, ...driver }),
          Animated.parallel([
            Animated.timing(monsterOpacity, { toValue: 0, duration: 380, ...driver }),
            Animated.timing(monsterScale, { toValue: 0.5, duration: 380, ...driver }),
          ]),
        ]),
        Animated.timing(xpFloat, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), ...driver }),
      ]),
    ]);
    attackAnim.current?.stop();
    attackAnim.current = attack;
    attack.start(({ finished }) => {
      if (!finished) return; // A newer attack took over.
      attackAnim.current = null;
      setDying(null);
      // The next monster steps out of the shadows.
      monsterX.setValue(40);
      monsterScale.setValue(1);
      Animated.parallel([
        Animated.timing(monsterOpacity, { toValue: 1, duration: 300, ...driver }),
        Animated.timing(monsterX, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), ...driver }),
      ]).start();
    });
    // Only completions should trigger the attack; the maps are read for the slain monster's details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout]);

  useEffect(() => () => attackAnim.current?.stop(), []);

  // ---------- Dungeon guide ----------
  const shown = dying?.monster ?? monster;
  const holding = setTimer && encounter && setTimer.setKey === encounter.setKey ? setTimer : null;
  const holdLeft = holding ? Math.max(0, (holding.endsAt - now) / 1000) : 0;
  const hp = dying ? 0 : holding ? holdLeft / holding.duration : 1;
  const restLeft = restTimer ? Math.max(0, Math.ceil((restTimer.endsAt - now) / 1000)) : 0;

  let headline: string;
  let guide: string;
  if (workout.exercises.length === 0) {
    headline = 'An empty dungeon';
    guide = 'Add exercises to summon monsters. Every set you tick off slays one.';
  } else if (!encounter || !current || !monster) {
    headline = 'Dungeon cleared!';
    guide = `Every monster is slain. Tap Finish to claim your ${xp} XP.`;
  } else {
    const exName = currentEx?.name ?? 'Exercise';
    const setNo = encounter.setIndex + 1;
    headline = `Room ${encounter.room}/${encounter.rooms} · ${exName} · set ${setNo}/${current.sets.length}`;
    const target = targetText(currentEx, current.sets[encounter.setIndex], previous.get(current.exerciseId)?.[encounter.setIndex], units);
    const foe = `${article(monster.name)} ${monster.name}`;
    if (holding) guide = `Hold the line! ${formatClock(Math.ceil(holdLeft))} until the ${monster.name} falls.`;
    else if (restTimer && restLeft > 0) guide = `Catch your breath… ${foe.toLowerCase()} attacks in ${formatClock(restLeft)}.`;
    else if (monster.boss) guide = `${foe} awakens! Go all out${target ? `: ${target}` : ''}.`;
    else if (monster.elite) guide = `${foe} guards the exit${target ? `. Defeat it with ${target}` : ''}.`;
    else guide = `${foe} blocks the way${target ? `. Strike with ${target}` : ''}.`;
  }

  const toggle = () => {
    collapsedMemo = !collapsed;
    setCollapsed(!collapsed);
  };

  return (
    <View style={styles.panel}>
      <Pressable onPress={toggle} style={styles.headRow} accessibilityLabel={collapsed ? 'Show battle' : 'Hide battle'}>
        <Ionicons name="skull-outline" size={14} color={colors.warning} />
        <Text style={styles.headline} numberOfLines={1}>
          {headline}
        </Text>
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={colors.muted} />
      </Pressable>

      {!collapsed && (
        <View style={styles.scene}>
          <DungeonBackdrop />
          <Animated.View
            style={[
              styles.hero,
              { transform: [{ translateX: heroX }, { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] },
            ]}
          >
            <HeroSprite size={SPRITE} />
          </Animated.View>

          <View style={styles.foe}>
            {shown ? (
              <>
                <View style={styles.nameplate}>
                  <Text style={[styles.foeName, shown.boss && { color: '#F87171' }, shown.elite && { color: '#FACC15' }]} numberOfLines={1}>
                    {shown.name}
                  </Text>
                  <Text style={styles.foeLevel}>Lv {shown.level}</Text>
                </View>
                <View style={styles.hpTrack}>
                  <View style={[styles.hpFill, { width: `${Math.round(hp * 100)}%` }]} />
                </View>
                <Animated.View
                  style={{
                    opacity: monsterOpacity,
                    transform: [
                      { translateX: monsterX },
                      {
                        translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, shown.kind === 'bat' ? -6 : -1.5] }),
                      },
                      { scale: monsterScale },
                    ],
                  }}
                >
                  <MonsterSprite kind={shown.kind} elite={shown.elite} size={shown.boss ? SPRITE + 12 : SPRITE} />
                  <Animated.View pointerEvents="none" style={[styles.slash, { opacity: slash }]} />
                </Animated.View>
              </>
            ) : workout.exercises.length > 0 ? (
              <ChestSprite size={SPRITE} />
            ) : null}
            {dying ? (
              <Animated.Text
                style={[
                  styles.xpFloat,
                  {
                    opacity: xpFloat.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                    transform: [{ translateY: xpFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }],
                  },
                ]}
              >
                +{dying.xp} XP
              </Animated.Text>
            ) : null}
          </View>
        </View>
      )}

      <Text style={styles.guide}>{guide}</Text>
      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: total ? `${(done / total) * 100}%` : '0%' }]} />
        </View>
        <Text style={styles.footerText}>
          {done}/{total} slain · <Text style={{ color: colors.warning, fontWeight: '700' }}>{xp} XP</Text>
        </Text>
      </View>
    </View>
  );
}

/** Stone wall, floor and two torches. */
function DungeonBackdrop() {
  const bricks = [];
  for (let row = 0; row < 5; row++) {
    for (let col = -1; col < 14; col++) {
      const x = col * 30 + (row % 2 ? 15 : 0);
      bricks.push(<Rect key={`${row}-${col}`} x={x + 1} y={row * 18 + 1} width={28} height={16} rx={2} fill="#262230" />);
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 130">
        <Rect x={0} y={0} width={400} height={130} fill="#1B1824" />
        {bricks}
        <Rect x={0} y={92} width={400} height={38} fill="#2A2420" />
        <Rect x={0} y={92} width={400} height={2} fill="#3B322B" />
        {[60, 340].map((x) => (
          <Path key={x} d={`M${x - 3} 52 L${x + 3} 52 L${x + 2} 66 L${x - 2} 66 Z`} fill="#5B3A1E" />
        ))}
        {[60, 340].map((x) => (
          <Ellipse key={`f${x}`} cx={x} cy={46} rx={5} ry={8} fill="#F97316" />
        ))}
        {[60, 340].map((x) => (
          <Ellipse key={`g${x}`} cx={x} cy={48} rx={2.5} ry={4.5} fill="#FDE047" />
        ))}
        {[60, 340].map((x) => (
          <Circle key={`h${x}`} cx={x} cy={48} r={26} fill="#F97316" opacity={0.08} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4C3A1E',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingBottom: spacing.xs },
  headline: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  scene: {
    height: 130,
    borderRadius: radius.md,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  hero: { marginBottom: 0 },
  foe: { alignItems: 'center', maxWidth: 150 },
  nameplate: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  foeName: { color: colors.text, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  foeLevel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  hpTrack: { width: 70, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.5)', marginTop: 2, overflow: 'hidden' },
  hpFill: { height: '100%', backgroundColor: '#EF4444' },
  slash: {
    position: 'absolute',
    left: '15%',
    top: '45%',
    width: '70%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '-35deg' }],
  },
  xpFloat: { position: 'absolute', top: 18, color: '#FACC15', fontWeight: '800', fontSize: 15 },
  guide: { color: colors.muted, fontSize: 13, paddingHorizontal: 4, paddingTop: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 4, paddingTop: spacing.xs },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.warning },
  footerText: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
});
