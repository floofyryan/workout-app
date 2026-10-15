import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/lib/theme';
import { Button } from './ui';

const ROW_HEIGHT = 56;

export interface SortableItem {
  key: string;
  label: string;
  sublabel?: string;
  /** Optional colour bar on the left (e.g. to show a superset). */
  accent?: string | null;
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Drag-to-reorder list: press and drag the handle on the right of a row. */
export function SortableList({ items, onChange }: { items: SortableItem[]; onChange: (keys: string[]) => void }) {
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const target = drag ? Math.max(0, Math.min(items.length - 1, drag.index + Math.round(drag.dy / ROW_HEIGHT))) : -1;

  // One responder per row. `items` doesn't change while a row is being dragged, so these stay put
  // for the whole gesture.
  const responders = useMemo(
    () =>
      items.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => setDrag({ index, dy: 0 }),
          onPanResponderMove: (_, g) => setDrag({ index, dy: g.dy }),
          onPanResponderRelease: (_, g) => {
            const to = Math.max(0, Math.min(items.length - 1, index + Math.round(g.dy / ROW_HEIGHT)));
            setDrag(null);
            if (to !== index) onChange(moved(items, index, to).map((i) => i.key));
          },
          onPanResponderTerminate: () => setDrag(null),
        }),
      ),
    [items, onChange],
  );

  return (
    <ScrollView scrollEnabled={!drag} contentContainerStyle={{ paddingBottom: spacing.lg }}>
      <View style={{ height: items.length * ROW_HEIGHT }}>
        {items.map((item, i) => {
          let top = i * ROW_HEIGHT;
          if (drag) {
            if (i === drag.index) top = drag.index * ROW_HEIGHT + drag.dy;
            else if (drag.index < target && i > drag.index && i <= target) top -= ROW_HEIGHT;
            else if (drag.index > target && i < drag.index && i >= target) top += ROW_HEIGHT;
          }
          const active = drag?.index === i;
          return (
            <View key={item.key} style={[styles.row, { top }, active && styles.rowActive]}>
              {item.accent ? <View style={[styles.accent, { backgroundColor: item.accent }]} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.sublabel ? (
                  <Text style={styles.sublabel} numberOfLines={1}>
                    {item.sublabel}
                  </Text>
                ) : null}
              </View>
              <View {...responders[i].panHandlers} style={styles.handle} accessibilityLabel={`Drag ${item.label}`}>
                <Ionicons name="reorder-three" size={26} color={active ? colors.primary : colors.muted} />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Full-screen sheet for reordering a list; changes are applied with "Done". */
export function ReorderSheet({
  visible,
  title,
  items,
  onDone,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: SortableItem[];
  onDone: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const keys = order ?? items.map((i) => i.key);
  const ordered = useMemo(() => {
    const byKey = new Map(items.map((i) => [i.key, i]));
    return (order ?? items.map((i) => i.key)).map((k) => byKey.get(k)).filter((i): i is SortableItem => !!i);
  }, [items, order]);
  const close = () => {
    setOrder(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={close} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Button
            title="Done"
            small
            onPress={() => {
              onDone(keys);
              close();
            }}
          />
        </View>
        <Text style={styles.hint}>Drag the handles to change the order.</Text>
        <SortableList items={ordered} onChange={setOrder} />
      </SafeAreaView>
    </Modal>
  );
}

/** Row that can be swiped left to delete. */
export function SwipeToDelete({
  children,
  onDelete,
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}) {
  const [translateX] = useState(() => new Animated.Value(0));

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly horizontal swipes so taps, typing and vertical scrolling still work.
        onMoveShouldSetPanResponder: (_, g) => enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => translateX.setValue(Math.min(0, g.dx)),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -90) {
            Animated.timing(translateX, { toValue: -600, duration: 150, useNativeDriver: true }).start(() => {
              onDelete();
              translateX.setValue(0);
            });
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [enabled, onDelete, translateX],
  );

  return (
    <View style={styles.swipeContainer}>
      {/* Only visible while swiping, so it never shows through transparent rows. */}
      <Animated.View
        style={[
          styles.swipeBehind,
          { opacity: translateX.interpolate({ inputRange: [-40, 0], outputRange: [1, 0], extrapolate: 'clamp' }) },
        ]}
      >
        <Ionicons name="trash" size={18} color="#fff" />
        <Text style={styles.swipeText}>Delete</Text>
      </Animated.View>
      <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT - 6,
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    overflow: 'hidden',
  },
  rowActive: { backgroundColor: colors.cardAlt, zIndex: 10, elevation: 6, borderWidth: 1, borderColor: colors.primary },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sublabel: { color: colors.muted, fontSize: 12 },
  handle: { paddingHorizontal: spacing.md, height: '100%', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cancel: { color: colors.muted, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 13, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  swipeContainer: { position: 'relative' },
  swipeBehind: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: spacing.md,
    gap: 4,
  },
  swipeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
