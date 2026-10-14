import { useState } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';

import { formatClock, parseClock, parseNumber } from '@/lib/format';
import { clean } from '@/lib/units';
import { colors, radius } from '@/lib/theme';

function same(a: number | null, b: number | null) {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 1e-6;
}

/**
 * Numeric text field that keeps what the user typed (e.g. "62.") while reporting parsed
 * numbers. Re-syncs its text only when the value changes from outside.
 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  integer,
  style,
  autoFocus,
  selectTextOnFocus = true,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  integer?: boolean;
  style?: StyleProp<TextStyle>;
  autoFocus?: boolean;
  selectTextOnFocus?: boolean;
}) {
  const fmt = (v: number | null) => (v == null ? '' : String(clean(v, 2)));
  const [text, setText] = useState(fmt(value));
  const [lastValue, setLastValue] = useState(value);

  // Re-sync the text when the value changes from outside (adjusting state during render).
  if (!same(value, lastValue)) {
    setLastValue(value);
    if (!same(parseNumber(text), value == null ? null : clean(value, 2))) setText(fmt(value));
  }

  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = parseNumber(t);
        onChange(n == null ? null : integer ? Math.round(n) : n);
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      selectTextOnFocus={selectTextOnFocus}
      autoFocus={autoFocus}
      style={[styles.input, style]}
    />
  );
}

/** Text field for durations entered as "m:ss" (or plain seconds). */
export function DurationInput({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
}) {
  const fmt = (v: number | null) => (v == null ? '' : formatClock(v));
  const [text, setText] = useState(fmt(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (parseClock(text) !== value) setText(fmt(value));
  }

  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        onChange(parseClock(t));
      }}
      onBlur={() => setText(fmt(value))}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType="numbers-and-punctuation"
      selectTextOnFocus
      style={[styles.input, style]}
    />
  );
}

export const styles = StyleSheet.create({
  input: {
    minWidth: 0,
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
});
