import Svg, { Ellipse, Path } from 'react-native-svg';

import {
  CRITTER_BACK,
  CRITTER_FRONT,
  CRITTER_VIEWBOX,
  PALETTE,
  type CritterSlug,
  type Layer,
  type Shape,
} from '@/data/critterBody';

function ShapeView({
  shape,
  fill = 'none',
  stroke = 'none',
  strokeWidth = 0,
  opacity,
  onPress,
}: {
  shape: Shape;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  onPress?: () => void;
}) {
  const common = { fill, stroke, strokeWidth, opacity, onPress, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if ('ell' in shape) {
    const [cx, cy, rx, ry, rot] = shape.ell;
    return <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined} {...common} />;
  }
  return <Path d={shape.d} {...common} />;
}

const layerView = (l: Layer, key: string, onPress?: () => void) => (
  <ShapeView key={key} shape={l.shape} fill={l.fill} stroke={l.stroke} strokeWidth={l.strokeWidth} opacity={l.opacity} onPress={onPress} />
);

/** The "critter" body-map figure: a little fox-like creature flexing, with tappable muscles. */
export function CritterBody({
  side,
  scale,
  highlighted,
  highlightColor,
  onPress,
}: {
  side: 'front' | 'back';
  /** 1 = 200 px wide. */
  scale: number;
  highlighted: ReadonlySet<string>;
  highlightColor: string;
  onPress: (slug: CritterSlug) => void;
}) {
  const view = side === 'front' ? CRITTER_FRONT : CRITTER_BACK;
  return (
    <Svg
      viewBox={`0 0 ${CRITTER_VIEWBOX.width} ${CRITTER_VIEWBOX.height}`}
      width={CRITTER_VIEWBOX.width * scale}
      height={CRITTER_VIEWBOX.height * scale}
      accessibilityLabel={`critter-${side}`}
    >
      {view.under.map((l, i) => layerView(l, `u${i}`))}
      {view.parts.map((part) => {
        const press = () => onPress(part.slug);
        const fill = highlighted.has(part.slug) ? highlightColor : PALETTE.muscle;
        return [
          ...part.shapes.map((s, i) => (
            <ShapeView key={`${part.slug}${i}`} shape={s} fill={fill} stroke={PALETTE.line} strokeWidth={1} onPress={press} />
          )),
          ...(part.details ?? []).map((l, i) => layerView(l, `${part.slug}d${i}`, press)),
        ];
      })}
      {view.over.map((l, i) => layerView(l, `o${i}`))}
    </Svg>
  );
}
