import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function T({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  return <Text style={[styles.text, muted && styles.muted, style]} {...props} />;
}

export function Title({ style, ...props }: TextProps) {
  return <Text style={[styles.title, style]} {...props} />;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Card({ style, children, onPress, onLongPress }: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.cardAlt,
    danger: 'rgba(239,68,68,0.15)',
    success: colors.success,
    ghost: 'transparent',
  };
  const fg: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: colors.text,
    danger: colors.danger,
    success: '#fff',
    ghost: colors.primary,
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg[variant] },
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg[variant]} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg[variant] }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color = colors.text,
  size = 22,
  style,
  accessibilityLabel,
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={colors.faint} />
      <Text style={[styles.title, { fontSize: 18, marginTop: spacing.md }]}>{title}</Text>
      {message ? <Text style={[styles.text, styles.muted, { textAlign: 'center', marginTop: 4 }]}>{message}</Text> : null}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  icon,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  icon?: IconName;
  titleStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.listItem, pressed && (onPress || onLongPress) && styles.pressed]}
    >
      {icon && <Ionicons name={icon} size={22} color={colors.primary} style={{ marginRight: spacing.md }} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.text, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.small, styles.muted]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.small, styles.muted]}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 15 },
  small: { color: colors.text, fontSize: 13 },
  muted: { color: colors.muted },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  section: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.6 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: spacing.md },
  buttonText: { fontSize: 16, fontWeight: '600' },
  iconButton: { padding: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    marginRight: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.sm },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl * 2 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
