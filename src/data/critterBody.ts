// "Critter" body-map figure: a little fox-like gym creature in a double-biceps pose, drawn in a
// 200 × 350 box (centre x = 100). Muscle slugs match react-native-body-highlighter's, so every
// figure shares one slug → body part mapping. Left-side shapes are mirrored for the right side.

export type CritterSlug =
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

export type Shape = { d: string } | { ell: [cx: number, cy: number, rx: number, ry: number, rot?: number] };

export interface Layer {
  shape: Shape;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface CritterPart {
  slug: CritterSlug;
  shapes: Shape[];
  /** Extra detail drawn on top of the muscle (also tappable). */
  details?: Layer[];
}

export interface CritterView {
  /** Drawn first: tail, ears, fur silhouette. */
  under: Layer[];
  parts: CritterPart[];
  /** Drawn last: face, paws, feet. */
  over: Layer[];
}

export const CRITTER_VIEWBOX = { width: 200, height: 350 };

export const PALETTE = {
  fur: '#C8834E',
  furDark: '#9A5B30',
  muscle: '#E0A06C',
  line: '#6B3B1E',
  outline: '#3E2412',
  cream: '#F3E5D3',
  dark: '#2A1A10',
  pink: '#E9A99B',
};

// ---------- shape helpers ----------

const p = (d: string): Shape => ({ d });
const e = (cx: number, cy: number, rx: number, ry: number, rot?: number): Shape => ({ ell: [cx, cy, rx, ry, rot] });

export function mirrorShape(s: Shape): Shape {
  if ('ell' in s) {
    const [cx, cy, rx, ry, rot] = s.ell;
    return { ell: [200 - cx, cy, rx, ry, rot != null ? -rot : undefined] };
  }
  return { d: s.d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(200 - Number(x)).toFixed(2)},${y}`) };
}

const both = (...shapes: Shape[]) => shapes.flatMap((s) => [s, mirrorShape(s)]);
const layers = (shapes: Shape[], style: Omit<Layer, 'shape'>): Layer[] => shapes.map((shape) => ({ shape, ...style }));
const shine = (...shapes: Shape[]): Layer[] =>
  layers(both(...shapes), { stroke: '#FFFFFF', strokeWidth: 1.6, opacity: 0.35 });

const box = (x1: number, y1: number, x2: number, y2: number, r = 3) =>
  p(
    `M${x1 + r},${y1} L${x2 - r},${y1} Q${x2},${y1} ${x2},${y1 + r} L${x2},${y2 - r} Q${x2},${y2} ${x2 - r},${y2} ` +
      `L${x1 + r},${y2} Q${x1},${y2} ${x1},${y2 - r} L${x1},${y1 + r} Q${x1},${y1} ${x1 + r},${y1} Z`,
  );

// ---------- shared body (both views) ----------

const fur = (shapes: Shape[]) => layers(shapes, { fill: PALETTE.fur, stroke: PALETTE.outline, strokeWidth: 1.6 });

const EAR = p('M60,54 C52,36 47,20 49,5 C64,13 80,23 92,35 Z');
const EAR_TIP = p('M50.5,20 C49.5,14 49,9 49,5 C55,8 60,11 65,15 Z');
const HEAD = e(100, 78, 60, 50);
const CHEEK_TUFT = p('M42,86 L30,92 L43,96 L33,104 L47,104 Z');
const TORSO = p('M100,124 L72,127 C60,129 52,133 48,141 C47,161 51,181 56,197 C56,211 59,225 65,237 C77,243 89,245 100,245 Z');
const UPPER_ARM = p('M52,133 C40,128 24,128 13,136 C6,145 9,160 18,164 C28,166 42,162 54,157 Z');
const FOREARM_FUR = p('M7,150 C3,131 5,113 11,98 C17,93 26,95 28,101 C26,116 24,132 25,150 Z');
const LEG = p('M66,236 C60,254 60,276 64,294 C62,310 62,324 65,334 L91,334 C91,322 92,310 94,296 C98,278 99,262 100,246 Z');

const sharedUnder = (earInner: boolean): Layer[] => [
  ...fur(both(EAR)),
  ...(earInner ? layers(both(p('M63,46 C57,34 55,23 56,14 C66,20 76,27 84,35 Z')), { fill: PALETTE.pink }) : []),
  ...layers(both(EAR_TIP), { fill: PALETTE.dark }),
  ...fur(both(LEG)),
  ...fur(both(TORSO)),
  ...fur(both(UPPER_ARM, FOREARM_FUR)),
  ...fur(both(CHEEK_TUFT)),
  ...fur([HEAD]),
];

const PAWS: Layer[] = [
  // Fists by the ears, with knuckle lines.
  ...fur(both(e(19, 92, 12.5, 11))),
  ...layers(both(p('M10,89 C14,86 18,86 22,88'), p('M13,95 C17,93 22,93 27,95')), {
    stroke: PALETTE.line,
    strokeWidth: 1.2,
  }),
  // Feet with toe lines.
  ...fur(both(e(77, 338, 19, 8.5))),
  ...layers(both(p('M68,334 L68,342'), p('M76,333 L76,343'), p('M84,334 L84,342')), {
    stroke: PALETTE.line,
    strokeWidth: 1.2,
  }),
];

const DELTOID = e(52, 144, 13, 12);
const FOREARM = e(16, 122, 8, 20, 6);
const NECK = p('M82,123 C90,131 110,131 118,123 L120,133 C110,139 90,139 80,133 Z');

// ---------- front ----------

export const CRITTER_FRONT: CritterView = {
  under: sharedUnder(true),
  parts: [
    { slug: 'neck', shapes: [NECK], details: layers([p('M86,131 L88,135 L91,131 L94,136 L97,131 L100,136 L103,131 L106,136 L109,131 L112,135 L114,131')], { stroke: PALETTE.cream, strokeWidth: 1.2 }) },
    { slug: 'trapezius', shapes: both(p('M80,131 C74,134 66,136 60,137 C68,140 77,139 85,135 Z')) },
    { slug: 'deltoids', shapes: both(DELTOID), details: shine(p('M45,139 C48,136 52,135 56,136')) },
    {
      slug: 'chest',
      shapes: both(p('M65,139 C59,147 57,157 60,166 C69,174 86,174 98,168 L98,140 C90,134 76,134 65,139 Z')),
      details: shine(p('M68,147 C73,143 80,141 87,141')),
    },
    {
      slug: 'biceps',
      shapes: both(e(31, 140, 15, 9.5, -6)),
      details: shine(p('M22,136 C27,132 34,131 40,133')),
    },
    { slug: 'forearm', shapes: both(FOREARM) },
    {
      slug: 'abs',
      shapes: both(box(88, 172, 98.5, 188), box(88, 191, 98.5, 207), box(88, 210, 98.5, 226), p('M88,229 L98.5,229 L98.5,244 C94,242 90,238 88,234 Z')),
    },
    { slug: 'obliques', shapes: both(p('M59,170 C61,186 63,203 65.5,220 C71,230 78,236 85,238 L85,174 C76,174 67,172 59,170 Z')) },
    {
      slug: 'quadriceps',
      shapes: both(
        p('M66,246 C62,262 63,278 69,290 C75,296 84,296 89,290 C92,278 94,264 95,252 C86,245 76,243 66,246 Z'),
        p('M80,249 C78,262 78,276 80,291 C82,276 83,262 82,249 Z'),
      ),
      details: shine(p('M70,256 C69,264 69,272 71,280')),
    },
    { slug: 'adductors', shapes: both(p('M96,254 C95,266 93,278 91,288 C95,278 98,266 99,252 C98,251 97,251 96,254 Z')) },
    { slug: 'tibialis', shapes: both(p('M70,302 C68,312 68,322 70,332 L76,332 C76,322 76,312 77,302 C75,300 72,300 70,302 Z')) },
    { slug: 'calves', shapes: both(p('M80,301 C86,310 88,320 85,332 L80,332 C79,322 79,310 80,301 Z')) },
  ],
  over: [
    // Face: muzzle, blush, eyes, nose, smile, brows.
    ...layers([p('M100,86 C88,86 70,92 64,106 C72,122 88,128 100,128 C112,128 128,122 136,106 C130,92 112,86 100,86 Z')], {
      fill: PALETTE.cream,
    }),
    ...layers(both(e(64, 101, 7.5, 4)), { fill: '#E58A8A', opacity: 0.55 }),
    ...layers(both(e(79, 78, 9.5, 11.5)), { fill: '#FFFFFF', stroke: PALETTE.outline, strokeWidth: 1.2 }),
    ...layers(both(e(80.5, 80, 6.5, 8.5)), { fill: PALETTE.dark }),
    ...layers(both(e(78, 76.5, 2.4, 2.6)), { fill: '#FFFFFF' }),
    ...layers(both(p('M68,62 C74,58.5 82,58.5 89,62.5')), { stroke: PALETTE.furDark, strokeWidth: 2.4 }),
    ...layers([e(100, 96, 6.5, 4.5)], { fill: PALETTE.dark }),
    ...layers([p('M91,104 C95,110 100,110 100,105 C100,110 105,110 109,104')], { stroke: PALETTE.dark, strokeWidth: 1.6 }),
    ...PAWS,
  ],
};

// ---------- back ----------

const TAIL = p('M104,236 C128,252 160,258 177,240 C191,224 193,200 182,184 C185,205 177,224 161,231 C145,237 124,235 106,226 Z');
const TAIL_TIP = p('M182,184 C193,195 195,212 189,226 C187,212 185,198 182,184 Z');
const TAIL_FUR = p('M150,236 L158,232 M164,231 L170,226 M136,236 L144,234');

export const CRITTER_BACK: CritterView = {
  under: [
    ...fur([TAIL]),
    ...layers([TAIL_TIP], { fill: PALETTE.cream, stroke: PALETTE.outline, strokeWidth: 1.6 }),
    ...layers([TAIL_FUR], { stroke: PALETTE.furDark, strokeWidth: 1.2 }),
    ...sharedUnder(false),
  ],
  parts: [
    { slug: 'neck', shapes: [NECK] },
    {
      slug: 'trapezius',
      shapes: [p('M83,128 C75,132 66,134 58,138 C68,144 82,156 100,186 C118,156 132,144 142,138 C134,134 125,132 117,128 C110,131 90,131 83,128 Z')],
      details: layers([p('M100,140 L100,180')], { stroke: PALETTE.line, strokeWidth: 1 }),
    },
    { slug: 'deltoids', shapes: both(DELTOID), details: shine(p('M45,139 C48,136 52,135 56,136')) },
    {
      slug: 'upper-back',
      shapes: both(p('M57,150 C57,170 61,190 67,206 C77,202 89,196 96,187 C88,172 75,158 63,148 Z')),
      details: shine(p('M62,160 C63,172 66,184 70,194')),
    },
    {
      slug: 'lower-back',
      shapes: [p('M80,212 C88,204 95,196 100,188 C105,196 112,204 120,212 C118,222 117,230 117,236 L83,236 C83,230 82,222 80,212 Z')],
      details: layers([p('M100,196 L100,234')], { stroke: PALETTE.line, strokeWidth: 1 }),
    },
    { slug: 'triceps', shapes: both(e(31, 153, 15, 8, 4)), details: shine(p('M22,155 C28,158 35,158 41,156')) },
    { slug: 'forearm', shapes: both(FOREARM) },
    {
      slug: 'gluteal',
      shapes: both(p('M64,237 C59,250 62,263 70,269 C80,274 92,272 99,265 L99,237 C88,232 74,232 64,237 Z')),
      details: shine(p('M70,244 C74,240 81,238 88,239')),
    },
    {
      slug: 'hamstring',
      shapes: both(
        p('M65,273 C63,283 64,293 68,300 L78,302 C80,292 81,282 82,273 C76,270 70,270 65,273 Z'),
        p('M85,273 C87,283 89,293 89,300 L80,302 C82,292 83,282 85,273 Z'),
      ),
    },
    {
      slug: 'calves',
      shapes: both(
        p('M67,304 C62,312 63,322 69,330 C75,334 83,333 86,328 C90,320 89,310 86,303 C80,299 72,299 67,304 Z'),
        p('M77,302 C79,312 79,320 78,330 C77,320 76,312 77,302 Z'),
      ),
    },
  ],
  over: [
    // Tuft of fur on the back of the head.
    ...layers([p('M90,34 C93,26 97,22 100,30 C103,22 107,26 110,34')], { stroke: PALETTE.furDark, strokeWidth: 2 }),
    ...PAWS,
    // Paw pads on the soles.
    ...layers(both(e(77, 339, 6, 3)), { fill: PALETTE.pink }),
  ],
};
