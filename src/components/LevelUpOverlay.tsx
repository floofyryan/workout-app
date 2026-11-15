import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { formatNumber } from '@/lib/format';
import { rankFor, STAT_INFO, type WorkoutReward } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { RankBadge } from './Hero';
import { Button } from './ui';

// The web build animates in JS; everywhere else transforms and opacity run on the native thread.
const useNativeDriver = Platform.OS !== 'web';

/** react-native-web only implements Share on top of the Web Share API, which desktop browsers often lack. */
const canShare = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

/** The text card behind the Share button. */
export function levelUpShareMessage(reward: WorkoutReward, heroName: string, workoutName?: string): string {
  const rank = rankFor(reward.levelAfter);
  const from = workoutName?.trim() ? ` from ${workoutName.trim()}` : '';
  return `${heroName} reached Level ${reward.levelAfter} (Rank ${rank.letter} · ${rank.title}) — +${formatNumber(reward.total)} XP${from}`;
}

interface Props {
  visible: boolean;
  /** The reward of the workout that caused the level-up. */
  reward: WorkoutReward;
  heroName: string;
  /** Named in the shared text ("… XP from Push"). */
  workoutName?: string;
  onClose: () => void;
}

/** Full-screen celebration for a level-up: the new level, the rank, and what the workout earned. */
export function LevelUpOverlay({ visible, ...props }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={props.onClose}>
      {/* Mounted only while visible, so the animation starts from scratch each time it is shown. */}
      {visible ? <Celebration {...props} /> : null}
    </Modal>
  );
}

function Celebration({ reward, heroName, workoutName, onClose }: Omit<Props, 'visible'>) {
  const rankBefore = rankFor(reward.levelBefore);
  const rank = rankFor(reward.levelAfter);
  const rankUp = rank.letter !== rankBefore.letter;
  const statUps = reward.stats.filter((s) => s.levelAfter > s.levelBefore);

  const [heading] = useState(() => new Animated.Value(0));
  const [level] = useState(() => new Animated.Value(0));
  const [badge] = useState(() => new Animated.Value(0));
  const [details] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const fade = (value: Animated.Value, duration: number) =>
      Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver });
    const intro = Animated.sequence([
      Animated.delay(150),
      fade(heading, 300),
      Animated.spring(level, { toValue: 1, friction: 5, tension: 70, useNativeDriver }),
      // A new rank lands harder: it slams in from oversized instead of popping up.
      rankUp
        ? Animated.spring(badge, { toValue: 1, friction: 4, tension: 55, useNativeDriver })
        : Animated.spring(badge, { toValue: 1, friction: 7, tension: 80, useNativeDriver }),
      fade(details, 350),
    ]);
    const ring = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver }),
    );
    intro.start(({ finished }) => {
      if (finished && rankUp) ring.start();
    });
    return () => {
      intro.stop();
      ring.stop();
    };
  }, [heading, level, badge, details, pulse, rankUp]);

  const share = async () => {
    try {
      await Share.share({ message: levelUpShareMessage(reward, heroName, workoutName) });
    } catch {
      // Sharing was unavailable or cancelled; nothing to do.
    }
  };

  const badgeSize = rankUp ? 76 : 48;
  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.content} pointerEvents="box-none">
        <Animated.Text
          style={[
            styles.heading,
            { opacity: heading, transform: [{ translateY: heading.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
          ]}
        >
          LEVEL UP
        </Animated.Text>
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: level.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
            transform: [{ scale: level.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          }}
        >
          <Text style={styles.level}>{reward.levelAfter}</Text>
          <Text style={styles.levelFrom}>
            Level {reward.levelBefore} <Ionicons name="arrow-forward" size={13} color={colors.muted} /> {reward.levelAfter}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.rank,
            {
              opacity: badge.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [rankUp ? 2.4 : 0.6, 1] }) }],
            },
          ]}
        >
          {rankUp ? <Text style={[styles.newRank, { color: rank.color }]}>NEW RANK</Text> : null}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {rankUp ? (
              <Animated.View
                style={[
                  styles.ring,
                  {
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: badgeSize * 0.28,
                    borderColor: rank.color,
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                  },
                ]}
              />
            ) : null}
            <RankBadge rank={rank} size={badgeSize} />
          </View>
          <Text style={[styles.rankTitle, rankUp && { fontSize: 18 }, { color: rank.color }]}>
            Rank {rank.letter} · {rank.title}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.details,
            { opacity: details, transform: [{ translateY: details.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.xp}>
            <Ionicons name="flash" size={18} color={colors.xp} />
            <Text style={styles.xpText}> +{formatNumber(reward.total)} XP</Text>
          </View>
          {statUps.length > 0 && (
            <View style={styles.statChips}>
              {statUps.map((s) => (
                <View key={s.stat} style={[styles.statChip, { borderColor: STAT_INFO[s.stat].color }]}>
                  <Text style={[styles.statChipText, { color: STAT_INFO[s.stat].color }]}>
                    {STAT_INFO[s.stat].name} Lv {s.levelBefore} → {s.levelAfter}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.buttons}>
            {canShare ? <Button title="Share" icon="share-outline" variant="secondary" onPress={share} style={styles.button} /> : null}
            <Button title="Continue" onPress={onClose} style={styles.button} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(8,9,12,0.94)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  heading: { color: colors.xp, fontSize: 30, fontWeight: '900', letterSpacing: 6 },
  level: { color: colors.text, fontSize: 104, lineHeight: 112, fontWeight: '900', fontVariant: ['tabular-nums'] },
  levelFrom: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  rank: { alignItems: 'center', marginTop: spacing.xl },
  newRank: { fontSize: 12, fontWeight: '900', letterSpacing: 3, marginBottom: spacing.md },
  ring: { position: 'absolute', borderWidth: 2 },
  rankTitle: { fontSize: 15, fontWeight: '800', marginTop: spacing.md },
  details: { alignItems: 'center', alignSelf: 'stretch', marginTop: spacing.xl },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.xpDim,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  xpText: { color: colors.xp, fontSize: 18, fontWeight: '800' },
  statChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  statChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statChipText: { fontSize: 12, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl * 1.5, alignSelf: 'stretch', maxWidth: 420 },
  button: { flex: 1, borderRadius: radius.md },
});
