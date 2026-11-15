import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { GEAR_TIERS, gearTier, nextGear, STAT_INFO, STATS, type Achievement, type Character } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { HeroSprite } from './RpgSprites';
import { Card } from './ui';

/** Adventure-mode character: level, XP toward the next level and the five attributes. */
export function CharacterSheet({ character: c }: { character: Character }) {
  const tier = gearTier(c.level.level);
  const gear = GEAR_TIERS[tier];
  const upgrade = nextGear(c.level.level);
  const best = Math.max(10, ...STATS.map((s) => c.stats[s].value));
  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.portrait}>
          <HeroSprite size={72} tier={tier} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.level}>Level {c.level.level}</Text>
          <Text style={styles.title}>{c.title}</Text>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${(c.level.into / c.level.span) * 100}%` }]} />
          </View>
          <Text style={styles.small}>
            {c.level.into} / {c.level.span} XP to level {c.level.level + 1} · {c.slain} monsters slain
          </Text>
        </View>
      </View>
      <View style={styles.gear}>
        <Ionicons name="shield-half-outline" size={15} color={colors.warning} />
        <Text style={styles.gearText}>
          {gear.weapon} · {gear.armor}
          {upgrade ? <Text style={styles.small}>{`  ·  ${upgrade.weapon} at level ${upgrade.minLevel}`}</Text> : null}
        </Text>
      </View>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {STATS.map((s) => {
          const info = STAT_INFO[s];
          const value = c.stats[s].value;
          return (
            <View key={s} style={styles.statRow}>
              <Text style={[styles.statKey, { color: info.color }]}>{s}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statName}>{info.name}</Text>
                  <Text style={styles.small}>{info.trainedBy}</Text>
                </View>
                <View style={styles.statTrack}>
                  <View style={[styles.statFill, { width: `${(value / best) * 100}%`, backgroundColor: info.color }]} />
                </View>
              </View>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

/** Badges for the achievements, with progress toward the locked ones. */
export function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <View style={styles.grid}>
      {achievements.map((a) => (
        <View key={a.id} style={[styles.badge, a.unlocked && styles.badgeUnlocked]}>
          <View style={[styles.badgeIcon, a.unlocked && { backgroundColor: 'rgba(245,158,11,0.18)' }]}>
            <Ionicons
              name={a.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={a.unlocked ? colors.warning : colors.faint}
            />
          </View>
          <Text style={[styles.badgeName, !a.unlocked && { color: colors.muted }]} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={styles.badgeDesc} numberOfLines={2}>
            {a.description}
          </Text>
          {!a.unlocked && (
            <View style={styles.badgeTrack}>
              <View style={[styles.badgeFill, { width: `${(a.progress / a.target) * 100}%` }]} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gear: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  gearText: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  badgeUnlocked: { borderColor: 'rgba(245,158,11,0.5)' },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    marginBottom: 4,
  },
  badgeName: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  badgeDesc: { color: colors.faint, fontSize: 10, textAlign: 'center', marginTop: 2 },
  badgeTrack: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.cardAlt, marginTop: 6, overflow: 'hidden' },
  badgeFill: { height: '100%', backgroundColor: colors.faint },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  portrait: { backgroundColor: '#1B1824', borderRadius: radius.md, borderWidth: 1, borderColor: '#4C3A1E' },
  level: { color: colors.warning, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 1 },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden', marginTop: spacing.sm },
  xpFill: { height: '100%', backgroundColor: colors.warning },
  small: { color: colors.muted, fontSize: 12, marginTop: 3 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statKey: { width: 34, fontWeight: '800', fontSize: 13 },
  statLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  statTrack: { height: 5, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden', marginTop: 3 },
  statFill: { height: '100%' },
  statValue: { width: 28, textAlign: 'right', color: colors.text, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] },
});
