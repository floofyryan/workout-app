import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AchievementRow, ProgressBar } from '@/components/Achievements';
import { Card, SectionTitle } from '@/components/ui';
import { achievementStats } from '@/db/repo';
import { computeAchievements } from '@/lib/achievements';
import { useFocusQuery } from '@/lib/hooks';
import { colors, spacing } from '@/lib/theme';
import { useSettings } from '@/state/SettingsContext';

export default function AchievementsScreen() {
  const { settings } = useSettings();
  const [stats] = useFocusQuery(achievementStats);
  const list = useMemo(() => (stats ? computeAchievements(stats, settings.units) : null), [stats, settings.units]);
  if (!list) return null;

  // Most recently earned first, then the closest to being earned.
  const earned = list.filter((a) => a.earnedAt != null).sort((a, b) => b.earnedAt! - a.earnedAt!);
  const toGo = list.filter((a) => a.earnedAt == null).sort((a, b) => b.progress - a.progress);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.count}>
          {earned.length} <Text style={styles.of}>of {list.length} earned</Text>
        </Text>
        <ProgressBar value={earned.length / list.length} color={colors.warning} />
      </Card>
      {earned.length > 0 && (
        <>
          <SectionTitle>Earned</SectionTitle>
          <Card>
            {earned.map((a) => (
              <AchievementRow key={a.key} achievement={a} />
            ))}
          </Card>
        </>
      )}
      {toGo.length > 0 && (
        <>
          <SectionTitle>Still to go</SectionTitle>
          <Card>
            {toGo.map((a) => (
              <AchievementRow key={a.key} achievement={a} />
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  count: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.sm },
  of: { color: colors.muted, fontSize: 16, fontWeight: '600' },
});
