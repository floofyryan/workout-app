import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

import { colors, radius, spacing } from '@/lib/theme';
import type { BodyPart } from '@/lib/types';
import { Chip } from './ui';

type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: 'path'; d: string };

const e = (cx: number, cy: number, rx: number, ry: number, rot?: number): Shape => ({ kind: 'ellipse', cx, cy, rx, ry, rot });
const p = (d: string): Shape => ({ kind: 'path', d });

/** Mirrors a shape across the figure's centre line (x = 50). */
function mirror(s: Shape): Shape {
  if (s.kind === 'ellipse') return { ...s, cx: 100 - s.cx, rot: s.rot != null ? -s.rot : undefined };
  return { kind: 'path', d: s.d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${100 - Number(x)},${y}`) };
}
const both = (s: Shape) => [s, mirror(s)];

// Figures are drawn in a 100 × 200 box, facing the viewer.
const SILHOUETTE: Shape[] = [
  e(50, 13, 8.5, 10.5), // head
  ...both(e(21, 92, 3.5, 5)), // hands
  p('M41,92 L59,92 L58,103 L50,106 L42,103 Z'), // hips
  ...both(e(41.5, 144, 5, 4)), // knees
  ...both(e(40.5, 188, 5.5, 3.5)), // feet
];

const FRONT: [BodyPart, Shape[]][] = [
  ['Neck', [p('M45,23 L55,23 L56.5,31 L43.5,31 Z')]],
  ['Shoulders', both(e(31, 38, 7.5, 6.5, -20))],
  ['Chest', both(p('M49.5,33 L39,33 Q34,39 36.5,48 Q43,53 49.5,51 Z'))],
  ['Biceps', both(e(27, 55, 4.8, 10, 10))],
  ['Forearms', both(e(23.5, 76, 4.2, 11, 8))],
  ['Core', [p('M39,53 Q50,56 61,53 L59.5,91 L40.5,91 Z')]],
  ['Quads', both(e(42.5, 121, 7.5, 19, 4))],
  ['Calves', both(e(41.5, 165, 5, 17))],
];

const BACK: [BodyPart, Shape[]][] = [
  ['Neck', [p('M45,23 L55,23 L56,29 L44,29 Z')]],
  ['Shoulders', both(e(31, 38, 7.5, 6.5, -20))],
  // Traps, lats and lower back.
  ['Back', [p('M44,29 L56,29 L63,35 L62,52 L58,72 L59,90 L41,90 L42,72 L38,52 L37,35 Z')]],
  ['Triceps', both(e(27, 55, 4.8, 10, 10))],
  ['Forearms', both(e(23.5, 76, 4.2, 11, 8))],
  ['Glutes', both(e(44.5, 100, 7, 8.5))],
  ['Hamstrings', both(e(42.5, 126, 7, 16, 4))],
  ['Calves', both(e(41.5, 165, 5.5, 16))],
];

/** Body parts that aren't a single area on the figure. */
const EXTRA_PARTS: BodyPart[] = ['Full Body', 'Cardio', 'Other'];

function ShapeView({ shape, fill, stroke }: { shape: Shape; fill: string; stroke: string }) {
  if (shape.kind === 'ellipse') {
    return (
      <Ellipse
        cx={shape.cx}
        cy={shape.cy}
        rx={shape.rx}
        ry={shape.ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.8}
        transform={shape.rot ? `rotate(${shape.rot} ${shape.cx} ${shape.cy})` : undefined}
      />
    );
  }
  return <Path d={shape.d} fill={fill} stroke={stroke} strokeWidth={0.8} strokeLinejoin="round" />;
}

function Figure({
  regions,
  offsetX,
  label,
  selected,
  onSelect,
}: {
  regions: [BodyPart, Shape[]][];
  offsetX: number;
  label: string;
  selected: BodyPart | null;
  onSelect: (part: BodyPart) => void;
}) {
  return (
    <G transform={`translate(${offsetX} 0)`}>
      {SILHOUETTE.map((s, i) => (
        <ShapeView key={i} shape={s} fill={colors.card} stroke={colors.border} />
      ))}
      {regions.map(([part, shapes]) => {
        const active = selected === part;
        return (
          <G key={part} onPress={() => onSelect(part)} accessibilityLabel={part}>
            {shapes.map((s, i) => (
              <ShapeView
                key={i}
                shape={s}
                fill={active ? colors.primary : colors.cardAlt}
                stroke={active ? '#93c5fd' : colors.faint}
              />
            ))}
          </G>
        );
      })}
      <SvgText x={50} y={199} fill={colors.muted} fontSize={7} fontWeight="700" textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

/**
 * Front and back body figure; tapping a muscle group selects that body part
 * (tapping it again clears the selection).
 */
export function BodyMap({
  selected,
  onSelect,
  counts,
}: {
  selected: BodyPart | null;
  onSelect: (part: BodyPart | null) => void;
  /** Number of exercises per body part, shown in the caption. */
  counts?: Map<BodyPart, number>;
}) {
  const toggle = (part: BodyPart) => onSelect(selected === part ? null : part);
  const caption = selected
    ? `${selected}${counts ? ` · ${counts.get(selected) ?? 0} exercises` : ''}`
    : 'Tap a muscle group';

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 210 202" style={styles.svg}>
        <Figure regions={FRONT} offsetX={0} label="FRONT" selected={selected} onSelect={toggle} />
        <Figure regions={BACK} offsetX={110} label="BACK" selected={selected} onSelect={toggle} />
      </Svg>
      <Text style={[styles.caption, selected && { color: colors.text }]}>{caption}</Text>
      <View style={styles.extras}>
        {EXTRA_PARTS.filter((part) => part !== 'Other' || (counts?.get('Other') ?? 0) > 0).map((part) => (
          <Chip key={part} label={part} selected={selected === part} onPress={() => toggle(part)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  svg: { width: '100%', maxWidth: 360, aspectRatio: 210 / 202 },
  caption: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: spacing.xs },
  extras: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
});
