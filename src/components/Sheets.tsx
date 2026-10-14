import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';
import { Button, type IconName } from './ui';

export interface SheetAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/** Bottom action sheet (Android's Alert only supports three buttons). */
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.cardAlt }]}
              onPress={() => {
                onClose();
                a.onPress();
              }}
            >
              {a.icon && (
                <Ionicons
                  name={a.icon}
                  size={20}
                  color={a.destructive ? colors.danger : colors.primary}
                  style={{ marginRight: spacing.md }}
                />
              )}
              <Text style={[styles.actionText, a.destructive && { color: colors.danger }]}>{a.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.action, { justifyContent: 'center' }]} onPress={onClose}>
            <Text style={[styles.actionText, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Cross-platform replacement for iOS-only Alert.prompt. */
export function PromptModal({
  visible,
  title,
  initialValue = '',
  placeholder,
  multiline,
  keyboardType,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [wasVisible, setWasVisible] = useState(visible);
  // Reset the text each time the prompt opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setValue(initialValue);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.center}>
        <View style={styles.dialog}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            autoFocus
            multiline={multiline}
            keyboardType={keyboardType}
            style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, gap: spacing.sm }}>
            <Button title="Cancel" variant="secondary" small onPress={onClose} />
            <Button
              title="Save"
              small
              onPress={() => {
                onSubmit(value);
                onClose();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  action: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  actionText: { color: colors.text, fontSize: 16 },
  center: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    marginHorizontal: spacing.lg - spacing.md,
  },
});
