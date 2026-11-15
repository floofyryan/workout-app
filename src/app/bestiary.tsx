import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonsterSprite } from '@/components/RpgSprites';
import { getStatEntries } from '@/db/repo';
import { useFocusQuery } from '@/lib/hooks';
import { bestiaryFrom } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';

/** Every monster in adventure mode, with how many you've slain; undiscovered ones stay hidden. */
export default function BestiaryScreen() {
  const [bestiary] = useFocusQuery(async (db) => bestiaryFrom(await getStatEntries(db)));
  if (!bestiary) return null;
  const found = bestiary.filter((m) => m.kills > 0).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        {found} of {bestiary.length} discovered · {bestiary.reduce((n, m) => n + m.kills, 0)} slain in total
      </Text>
      <View style={styles.grid}>
        {bestiary.map((m) => {
          const seen = m.kills > 0;
          return (
            <View key={m.name} style={[styles.tile, !seen && styles.hidden]}>
              <View style={[styles.portrait, !seen && { opacity: 0.12 }]}>
                <MonsterSprite kind={m.kind} elite={m.elite} size={64} />
              </View>
              <Text style={[styles.name, m.elite && seen && { color: '#FACC15' }]} numberOfLines={1}>
                {seen ? m.name : '???'}
              </Text>
              <Text style={[styles.kills, !seen && { color: colors.faint, fontWeight: '500' }]}>
                {seen ? `× ${m.kills}` : 'Not yet met'}
              </Text>
              <Text style={styles.habitat} numberOfLines={2}>
                {m.habitat}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 60 },
  intro: { color: colors.muted, fontSize: 13, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  hidden: { backgroundColor: colors.background },
  portrait: { backgroundColor: '#1B1824', borderRadius: radius.sm, marginBottom: 4 },
  name: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  kills: { color: colors.warning, fontSize: 12, fontWeight: '700', marginTop: 1 },
  habitat: { color: colors.faint, fontSize: 10, textAlign: 'center', marginTop: 2 },
});
