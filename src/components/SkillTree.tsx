import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { XpBar } from '@/components/Hero';
import { Card } from '@/components/ui';
import { getLiftTierData } from '@/db/heroQueries';
import { useFocusQuery } from '@/lib/hooks';
import { liftStandings, type LiftStanding } from '@/lib/liftTiers';
import { colors, radius, spacing } from '@/lib/theme';
import type { UnitSystem } from '@/lib/types';
import { clean, formatWeight, kgToDisplay, weightUnit } from '@/lib/units';
import { useSettings } from '@/state/SettingsContext';

const reps = (n: number) => `${n} ${n === 1 ? 'rep' : 'reps'}`;

/** Amount still missing, rounded up so that it never reads as "0 kg to Gold". */
function gap(s: LiftStanding, units: UnitSystem): string {
  const toNext = s.toNext ?? 0;
  if (s.unit === 'reps') return reps(Math.max(1, Math.ceil(toNext - 1e-9)));
  const v = Math.max(0.1, Math.ceil(kgToDisplay(toNext, units) * 10 - 1e-6) / 10);
  return `${clean(v, 1)} ${weightUnit(units)}`;
}

function bestText(s: LiftStanding, units: UnitSystem): string {
  if (s.value == null) return 'Not trained yet';
  if (s.unit === 'reps') return `Best ${reps(s.value)}`;
  const ratio = s.ratio == null ? '' : ` · ${clean(s.ratio, 2)}× body weight`;
  return `Est. 1RM ${formatWeight(s.value, units)}${ratio}`;
}

function nextText(s: LiftStanding, units: UnitSystem): string | null {
  if (s.status === 'needs_bodyweight') return 'Needs body weight';
  if (!s.nextTier) return s.status === 'ranked' ? 'Top tier reached' : null;
  return `${gap(s, units)} to ${s.nextTier.name}`;
}

function LiftRow({
  standing: s,
  exerciseId,
  units,
  first,
}: {
  standing: LiftStanding;
  exerciseId: number | null;
  units: UnitSystem;
  first: boolean;
}) {
  const locked = s.status !== 'ranked';
  const ranked = s.status === 'ranked' && s.tierIndex > 0;
  const next = nextText(s, units);
  const badge = s.status === 'untrained' ? 'Locked' : s.status === 'needs_bodyweight' ? 'No rank' : s.tier.name;
  const onPress =
    exerciseId == null
      ? undefined
      : () => router.push({ pathname: '/exercise/[id]', params: { id: String(exerciseId) } });
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${s.lift.name}, ${badge}. ${bestText(s, units)}${next ? `. ${next}` : ''}`}
      style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.icon, { borderColor: ranked ? s.tier.color : colors.border }, locked && { opacity: 0.6 }]}>
        <Ionicons
          name={s.status === 'untrained' ? 'lock-closed' : ranked ? 'medal' : 'barbell'}
          size={18}
          color={ranked ? s.tier.color : colors.faint}
        />
      </View>
      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, s.status === 'untrained' && { color: colors.muted }]} numberOfLines={1}>
            {s.lift.name}
          </Text>
          <View style={[styles.badge, { borderColor: ranked ? s.tier.color : colors.border }]}>
            <Text style={[styles.badgeText, { color: ranked ? s.tier.color : colors.faint }]}>{badge}</Text>
          </View>
        </View>
        <Text style={styles.text} numberOfLines={1}>
          {bestText(s, units)}
        </Text>
        {next && (
          <Text style={[styles.text, s.nextTier && { color: s.nextTier.color }, { fontWeight: '700' }]} numberOfLines={1}>
            {next}
          </Text>
        )}
        {s.status !== 'needs_bodyweight' && (
          <XpBar
            progress={s.progress}
            color={(s.nextTier ?? s.tier).color}
            height={4}
            style={{ marginTop: 5 }}
          />
        )}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

/**
 * Strength tiers for the main lifts, from the best estimated 1RM relative to body weight
 * (or best reps for bodyweight lifts). Loads its own data whenever the screen is focused.
 */
export function SkillTree() {
  const { settings } = useSettings();
  const [data] = useFocusQuery(getLiftTierData);
  if (!data) return null;
  const standings = liftStandings(data.lifts, data.bodyWeightKg);
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {data.bodyWeightKg == null && (
        <Pressable
          onPress={() => router.navigate('/measure')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.notice, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="scale-outline" size={18} color={colors.xp} />
          <Text style={styles.noticeText}>Log your body weight in the Measure tab to rank your lifts.</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.xp} />
        </Pressable>
      )}
      {standings.map((s, i) => (
        <LiftRow
          key={s.lift.id}
          standing={s}
          exerciseId={data.lifts[s.lift.id].exerciseId}
          units={settings.units}
          first={i === 0}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  badge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  text: { color: colors.muted, fontSize: 12, marginTop: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.xpDim,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  noticeText: { color: colors.xp, fontSize: 13, fontWeight: '600', flex: 1 },
});
