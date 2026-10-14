import Svg, { Path } from 'react-native-svg';

import {
  BACK_PARTS,
  FRONT_PARTS,
  OUTLINE_STROKES,
  SILHOUETTE_FILLS,
  mirror,
  type NeutralSlug,
} from '@/data/neutralBody';

/** Gender-neutral anatomical figure with the same props shape as react-native-body-highlighter's Body. */
export function NeutralBody({
  side,
  scale,
  highlighted,
  highlightColor,
  defaultFill,
  silhouetteFill,
  border,
  onPress,
}: {
  side: 'front' | 'back';
  scale: number;
  highlighted: ReadonlySet<string>;
  highlightColor: string;
  defaultFill: string;
  silhouetteFill: string;
  border: string;
  onPress: (slug: NeutralSlug) => void;
}) {
  const parts = side === 'front' ? FRONT_PARTS : BACK_PARTS;
  return (
    <Svg viewBox="0 0 200 400" width={200 * scale} height={400 * scale} accessibilityLabel={`body-${side}`}>
      {SILHOUETTE_FILLS.map((d) => (
        <Path key={d} d={d} fill={silhouetteFill} />
      ))}
      {parts.map((part) =>
        [...(part.common ?? []), ...(part.left ?? []), ...(part.left ?? []).map(mirror)].map((d) => (
          <Path
            key={d}
            id={part.slug}
            d={d}
            fill={highlighted.has(part.slug) ? highlightColor : defaultFill}
            stroke={silhouetteFill}
            strokeWidth={0.8}
            onPress={() => onPress(part.slug)}
          />
        )),
      )}
      {OUTLINE_STROKES.map((d) => (
        <Path key={`o${d}`} d={d} fill="none" stroke={border} strokeWidth={1.2} />
      ))}
    </Svg>
  );
}
