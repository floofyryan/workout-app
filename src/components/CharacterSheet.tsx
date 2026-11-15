import { StyleSheet, Text, View } from 'react-native';

import { STAT_INFO, STATS, type Character } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { HeroSprite } from './RpgSprites';
import { Card } from './ui';

/** Adventure-mode character: level, XP toward the next level and the five attributes. */
export function CharacterSheet({ character: c }: { character: Character }) {
  const best = Math.max(10, ...STATS.map((s) => c.stats[s].value));
  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.portrait}>
          <HeroSprite size={72} />
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

const styles = StyleSheet.create({
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
