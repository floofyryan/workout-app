// Gender-neutral anatomical figure for the body map, drawn in a 200 × 400 box (centre x = 100).
// Only the figure's left half is written out; mirror() produces the right half.
// Muscle names match react-native-body-highlighter's slugs so all figures share one mapping.

export type NeutralSlug =
  | 'neck'
  | 'trapezius'
  | 'deltoids'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'abs'
  | 'obliques'
  | 'upper-back'
  | 'lower-back'
  | 'gluteal'
  | 'adductors'
  | 'quadriceps'
  | 'hamstring'
  | 'tibialis'
  | 'calves';

export interface NeutralPart {
  slug: NeutralSlug;
  /** Paths drawn once (crossing the centre line). */
  common?: string[];
  /** Left-side paths; mirrored automatically for the right side. */
  left?: string[];
}

/** Mirrors absolute "x,y" coordinates across the centre line. */
export function mirror(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(200 - Number(x)).toFixed(2)},${y}`);
}

/** Left half of the body outline, from the top of the head round to the crotch. */
const HALF_OUTLINE =
  'M100,6 C87,6 81,16 82,30 C83,42 87,50 92,54 C92,58 92,62 91,65 C84,69 72,70 62,73 ' +
  'C50,76 43,86 42,100 C40,114 38,128 38,142 C37,152 36,158 36,164 C35,178 31,198 29,214 ' +
  'C28,222 27,226 27,230 C24,238 23,250 26,258 C28,264 34,264 35,258 C36,250 37,240 38,232 ' +
  'C40,224 41,220 42,214 C45,198 49,182 51,168 C53,156 54,140 55,126 C55,120 56,115 58,110 ' +
  'C60,128 62,150 64,170 C66,180 66,186 65,192 C62,204 61,216 62,228 C60,250 61,272 66,292 ' +
  'C67,298 67,302 67,306 C64,320 63,338 66,352 C68,362 69,368 69,374 C66,384 63,390 66,395 ' +
  'C72,399 86,399 88,394 C87,386 86,378 87,372 C89,360 91,344 90,330 C90,318 88,310 89,304 ' +
  'C92,290 96,264 97,246 C98,240 99,236 100,234';

/** Outline drawn as a stroke (left edge and its mirror); the centre seam is never stroked. */
export const OUTLINE_STROKES = [HALF_OUTLINE, mirror(HALF_OUTLINE)];
/** Closed halves used to fill the body silhouette. */
export const SILHOUETTE_FILLS = [`${HALF_OUTLINE} L100,8 Z`, `${mirror(HALF_OUTLINE)} L100,8 Z`];

const roundedBox = (x1: number, y1: number, x2: number, y2: number, r = 3) =>
  `M${x1 + r},${y1} L${x2 - r},${y1} C${x2},${y1} ${x2},${y1} ${x2},${y1 + r} L${x2},${y2 - r} ` +
  `C${x2},${y2} ${x2},${y2} ${x2 - r},${y2} L${x1 + r},${y2} C${x1},${y2} ${x1},${y2} ${x1},${y2 - r} ` +
  `L${x1},${y1 + r} C${x1},${y1} ${x1},${y1} ${x1 + r},${y1} Z`;

const NECK = 'M92.5,55 C93,60 92.5,63 91.5,66 C96,68 104,68 108.5,66 C107.5,63 107,60 107.5,55 C104,58 96,58 92.5,55 Z';
const DELTOID = 'M62,74 C51,77 44.5,86 43.5,99 C44,107 47,112 51,114 C53,102 58,90 67,80 C66,77 64,75 62,74 Z';
const UPPER_ARM = 'M44,118 C41.5,130 40.5,142 41,154 C43,161 49,162 51.5,156 C53,144 54,132 54.5,121 C52,115 47,114 44,118 Z';
const FOREARM = 'M38.5,166 C34,182 31,200 30,214 C32,220 36,220 38,216 C41,200 46,184 50.5,170 C47,164 41.5,162 38.5,166 Z';

export const FRONT_PARTS: NeutralPart[] = [
  { slug: 'neck', common: [NECK] },
  { slug: 'trapezius', left: ['M91.5,65 C84,69 73,71 64,73.5 C72,75.5 83,75 92,70.5 Z'] },
  { slug: 'deltoids', left: [DELTOID] },
  { slug: 'chest', left: ['M68,80 C61,89 57,100 58,112 C63,122 78,126 88,124 C93,123 96,121 98.5,118 L98.5,80 C90,76 78,76 68,80 Z'] },
  { slug: 'biceps', left: [UPPER_ARM] },
  { slug: 'forearm', left: [FOREARM] },
  {
    slug: 'abs',
    left: [
      roundedBox(88, 128, 98.5, 146),
      roundedBox(88, 149, 98.5, 167),
      roundedBox(88, 170, 98.5, 189),
      'M88,192 L98.5,192 L98.5,224 C94,220 90,212 88,204 Z',
    ],
  },
  { slug: 'obliques', left: ['M59.5,122 C61,145 63.5,168 65.5,188 C71,196 79,202 85.5,205 L85.5,128 C77,127 66,125 59.5,122 Z'] },
  {
    slug: 'quadriceps',
    left: [
      'M64,232 C61,252 62,272 67,288 C71,297 78,300 84,298 C89,295 92,288 93,280 C94,266 95,252 96,244 C88,236 76,231 64,232 Z',
      // Rectus femoris, drawn over the quad for definition.
      'M79,236 C76.5,256 76.5,276 80,293 C82.5,276 83.5,256 82.5,236.5 Z',
    ],
  },
  { slug: 'adductors', left: ['M96.5,244 C95,258 93.5,270 92.5,280 C96,268 98.5,254 99,242 C98,241 97,241 96.5,244 Z'] },
  { slug: 'tibialis', left: ['M70,312 C68,328 68.5,346 70.5,364 L76.5,364 C76.5,346 77,328 78.5,312 C76,309 72,309 70,312 Z'] },
  { slug: 'calves', left: ['M81,311 C87,324 89,340 86.5,358 L80.5,358 C80,342 79.5,326 81,311 Z'] },
];

export const BACK_PARTS: NeutralPart[] = [
  { slug: 'neck', common: [NECK] },
  {
    slug: 'trapezius',
    common: ['M92.5,62 C84,68 72,71 64,74 C73,80 85,96 100,146 C115,96 127,80 136,74 C128,71 116,68 107.5,62 C104,64 96,64 92.5,62 Z'],
  },
  { slug: 'deltoids', left: [DELTOID] },
  { slug: 'upper-back', left: ['M58.5,112 C60,136 64,158 70,178 C80,174 91,166 97,154 C89,128 79,104 69,88 C63,95 59.5,103 58.5,112 Z'] },
  { slug: 'lower-back', common: ['M80,184 C88,176 95,166 100,158 C105,166 112,176 120,184 C118,196 116,206 116,214 L84,214 C84,206 82,196 80,184 Z'] },
  { slug: 'triceps', left: [UPPER_ARM] },
  { slug: 'forearm', left: [FOREARM] },
  { slug: 'gluteal', left: ['M63,214 C59,232 62,250 70,258 C80,264 93,261 99,252 L99,212 C87,207 74,208 63,214 Z'] },
  {
    slug: 'hamstring',
    left: [
      'M64,262 C62,278 64,294 68,302 L79,304 C81,292 83,278 85,264 C78,261 70,260 64,262 Z',
      'M87,264 C89,278 91,292 90.5,302 L82,304 C84,290 85.5,276 87,264 Z',
    ],
  },
  {
    slug: 'calves',
    left: [
      'M68,312 C63,326 64,344 70,356 C75,362 82,360 85,350 C90,338 90,322 87,311 C82,307 73,307 68,312 Z',
      // Split between the two heads of the calf.
      'M78,311 C80,325 80.5,340 79,355 C77.5,340 77,325 78,311 Z',
    ],
  },
];
