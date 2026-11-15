import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RANKS, type Progress } from '@/lib/rpg';
import { colors, radius, spacing } from '@/lib/theme';
import { useSettings } from '@/state/SettingsContext';
import { achievementDescription, heroAccentFor, heroTitleFor } from './Hero';
import { Button } from './ui';

export const HERO_NAME_MAX = 24;

/**
 * Bottom sheet to rename the hero, equip the title of an unlocked achievement and pick an accent
 * colour from the ranks reached so far. Nothing is saved until "Save" is pressed.
 */
export function HeroCustomizeSheet({ visible, onClose, progress }: { visible: boolean; onClose: () => void; progress: Progress }) {
  const { settings, updateSettings } = useSettings();
  const [name, setName] = useState(settings.heroName);
  const [title, setTitle] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(false);
  // Start from what is equipped each time the sheet opens (a choice that is no longer unlocked counts as none).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(settings.heroName);
      setTitle(heroTitleFor(progress, settings)?.id ?? null);
      setAccent(heroAccentFor(progress, settings) === colors.xp ? null : settings.heroAccent);
    }
  }

  const level = progress.level.level;
  const accentColor = RANKS.find((r) => r.letter === accent)?.color ?? colors.xp;
  // Unlocked titles first, in their usual order.
  const titles = [...progress.achievements.filter((a) => a.unlocked), ...progress.achievements.filter((a) => !a.unlocked)];

  const save = () => {
    updateSettings({ heroName: name.trim().slice(0, HERO_NAME_MAX), heroTitle: title, heroAccent: accent });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Customize hero</Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Hero"
              placeholderTextColor={colors.faint}
              maxLength={HERO_NAME_MAX}
              returnKeyType="done"
              style={styles.input}
            />

            <Text style={styles.label}>Accent colour</Text>
            <View style={styles.swatches}>
              <Swatch color={colors.xp} label="Gold" selected={accent === null} onPress={() => setAccent(null)} />
              {RANKS.map((r) => {
                const locked = level < r.minLevel;
                return (
                  <Swatch
                    key={r.letter}
                    color={r.color}
                    label={locked ? `Lv ${r.minLevel}` : r.letter}
                    accessibilityLabel={locked ? `Rank ${r.letter}, unlocks at level ${r.minLevel}` : `Rank ${r.letter}`}
                    locked={locked}
                    selected={accent === r.letter}
                    onPress={() => setAccent(r.letter)}
                  />
                );
              })}
            </View>
            <Text style={styles.hint}>Reach a rank to unlock its colour.</Text>

            <Text style={styles.label}>Title</Text>
            <TitleRow label="No title" selected={title === null} color={accentColor} onPress={() => setTitle(null)} />
            {titles.map((a) => (
              <TitleRow
                key={a.id}
                label={a.title}
                detail={achievementDescription(a, settings.units)}
                locked={!a.unlocked}
                selected={title === a.id}
                color={accentColor}
                onPress={() => setTitle(a.id)}
              />
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Swatch({
  color,
  label,
  accessibilityLabel,
  selected,
  locked,
  onPress,
}: {
  color: string;
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: !!locked }}
      style={[styles.swatch, locked && styles.locked]}
    >
      <View style={[styles.swatchRing, selected && { borderColor: color }]}>
        <View style={[styles.swatchDot, { backgroundColor: color }]}>
          {locked ? (
            <Ionicons name="lock-closed" size={14} color={colors.background} />
          ) : selected ? (
            <Ionicons name="checkmark" size={18} color={colors.background} />
          ) : null}
        </View>
      </View>
      <Text style={[styles.swatchLabel, selected && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function TitleRow({
  label,
  detail,
  selected,
  locked,
  color,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  locked?: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!locked }}
      style={({ pressed }) => [styles.titleRow, pressed && { backgroundColor: colors.cardAlt }, locked && styles.locked]}
    >
      <Ionicons
        name={locked ? 'lock-closed' : selected ? 'radio-button-on' : 'radio-button-off'}
        size={locked ? 18 : 20}
        color={locked ? colors.faint : selected ? color : colors.faint}
        style={styles.titleIcon}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.titleText, selected && { color }]}>{label}</Text>
        {detail ? <Text style={styles.titleDetail}>{locked ? `Locked · ${detail}` : detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.faint, fontSize: 12, marginTop: spacing.xs },
  input: { backgroundColor: colors.cardAlt, color: colors.text, borderRadius: radius.sm, padding: spacing.md, fontSize: 16 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { alignItems: 'center', width: 48 },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  swatchLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  locked: { opacity: 0.45 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  titleIcon: { width: 22, textAlign: 'center', marginRight: spacing.md },
  titleText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  titleDetail: { color: colors.muted, fontSize: 12, marginTop: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
