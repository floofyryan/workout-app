import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import {
  GOBLIN_BACK,
  GOBLIN_FRONT,
  GOBLIN_VIEWBOX,
  GRADIENTS,
  MUSCLE_FILL,
  MUSCLE_HIGHLIGHT_FILL,
  PALETTE,
  type GoblinSlug,
  type Layer,
  type Shape,
} from '@/data/goblinBody';

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

function GradientDefs() {
  return (
    <Defs>
      {Object.entries(GRADIENTS).map(([id, g]) => {
        const stops = g.stops.map(([offset, color]) => <Stop key={offset} offset={offset} stopColor={color} />);
        if (g.type === 'linear') {
          const [x1, y1, x2, y2] = g.coords;
          return (
            <LinearGradient key={id} id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
              {stops}
            </LinearGradient>
          );
        }
        const [cx, cy, r] = g.coords;
        return (
          <RadialGradient key={id} id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy}>
            {stops}
          </RadialGradient>
        );
      })}
    </Defs>
  );
}

/** The goblin body-map figure: a little gym goblin flexing, with tappable muscles. */
export function GoblinBody({
  side,
  scale,
  highlighted,
  onPress,
}: {
  side: 'front' | 'back';
  /** 1 = 200 px wide. */
  scale: number;
  highlighted: ReadonlySet<string>;
  onPress: (slug: GoblinSlug) => void;
}) {
  const view = side === 'front' ? GOBLIN_FRONT : GOBLIN_BACK;
  return (
    <Svg
      viewBox={`0 0 ${GOBLIN_VIEWBOX.width} ${GOBLIN_VIEWBOX.height}`}
      width={GOBLIN_VIEWBOX.width * scale}
      height={GOBLIN_VIEWBOX.height * scale}
      accessibilityLabel={`goblin-${side}`}
    >
      <GradientDefs />
      {view.under.map((l, i) => layerView(l, `u${i}`))}
      {view.parts.map((part) => {
        const press = () => onPress(part.slug);
        const fill = highlighted.has(part.slug) ? MUSCLE_HIGHLIGHT_FILL : MUSCLE_FILL;
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
