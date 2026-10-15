// "Critter" body-map figure: a little gym goblin in a double-biceps pose, drawn in a
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
  /** Drawn first: ears, skin silhouette. */
  under: Layer[];
  parts: CritterPart[];
  /** Drawn last: face, hands, feet, clothing. */
  over: Layer[];
}

export const CRITTER_VIEWBOX = { width: 200, height: 350 };

export const PALETTE = {
  skin: '#6E9F4A',
  skinDark: '#4C7631',
  muscle: '#88BA5E',
  line: '#2F4A1E',
  outline: '#1C2B12',
  tooth: '#F1EBD0',
  dark: '#17130F',
  eye: '#F5D142',
  earInner: '#B9876F',
  hair: '#2B2620',
  leather: '#7A5230',
  leatherDark: '#4E331C',
  gold: '#D9B44A',
  wrap: '#D8CBA6',
};

export interface GradientDef {
  type: 'linear' | 'radial';
  /** Linear: x1, y1, x2, y2. Radial: cx, cy, r. All relative to each shape's bounding box. */
  coords: number[];
  stops: [offset: number, color: string][];
}

/** Gradients referenced by fills such as 'url(#skin)'; every renderer must define these ids. */
export const GRADIENTS: Record<string, GradientDef> = {
  skin: { type: 'linear', coords: [0, 0, 0.35, 1], stops: [[0, '#86BC5D'], [1, '#456D2B']] },
  head: { type: 'radial', coords: [0.42, 0.36, 0.72], stops: [[0, '#97CB6B'], [0.7, '#6A9A47'], [1, '#4A752F']] },
  muscle: { type: 'linear', coords: [0, 0, 0.3, 1], stops: [[0, '#B6E28C'], [0.55, '#86B85B'], [1, '#5A8B36']] },
  muscleHi: { type: 'linear', coords: [0, 0, 0.3, 1], stops: [[0, '#9CC8FF'], [1, '#2563EB']] },
  eye: { type: 'radial', coords: [0.45, 0.4, 0.65], stops: [[0, '#FFF6B0'], [0.6, '#F5D142'], [1, '#D98E1B']] },
  hair: { type: 'linear', coords: [0, 0, 0, 1], stops: [[0, '#4D4236'], [1, '#191510']] },
  leather: { type: 'linear', coords: [0, 0, 0, 1], stops: [[0, '#8E6239'], [1, '#5A3A1E']] },
  gold: { type: 'linear', coords: [0, 0, 0.6, 1], stops: [[0, '#F6DA7A'], [1, '#B08A2C']] },
};

/** Fill used for a muscle (normal or highlighted). */
export const MUSCLE_FILL = 'url(#muscle)';
export const MUSCLE_HIGHLIGHT_FILL = 'url(#muscleHi)';

const SHADOW = '#10190A';

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

const skin = (shapes: Shape[]) => layers(shapes, { fill: 'url(#skin)', stroke: PALETTE.outline, strokeWidth: 1.6 });
const shade = (shapes: Shape[], opacity = 0.28) => layers(shapes, { fill: SHADOW, opacity });

// Long goblin ears sticking out and up from the sides of the head.
const EAR = p('M55,62 C40,54 22,46 6,38 C14,54 28,72 54,86 Z');
const EAR_INNER = p('M51,66 C40,59 27,52 15,46 C23,57 33,68 50,80 Z');
const HEAD = p('M100,32 C72,32 52,48 50,74 C48,98 64,122 100,128 C136,122 152,98 150,74 C148,48 128,32 100,32 Z');
const MOHAWK = p('M88,40 L86,20 L93,32 L100,10 L107,32 L114,20 L112,40 C106,36 94,36 88,40 Z');
const TORSO = p('M100,124 L72,127 C60,129 52,133 48,141 C47,161 51,181 56,197 C56,211 59,225 65,237 C77,243 89,245 100,245 Z');
const UPPER_ARM = p('M52,133 C40,128 24,128 13,136 C6,145 9,160 18,164 C28,166 42,162 54,157 Z');
const FOREARM_SKIN = p('M7,150 C3,131 5,113 11,98 C17,93 26,95 28,101 C26,116 24,132 25,150 Z');
const LEG = p('M66,236 C60,254 60,276 64,294 C62,310 62,324 65,334 L91,334 C91,322 92,310 94,296 C98,278 99,262 100,246 Z');

const sharedUnder = (front: boolean): Layer[] => [
  ...GROUND_SHADOW,
  ...skin(both(EAR)),
  ...(front ? layers(both(EAR_INNER), { fill: PALETTE.earInner }) : layers(both(p('M50,70 C38,64 26,57 16,50')), { stroke: PALETTE.skinDark, strokeWidth: 1.4 })),
  // A nick out of one ear and a gold hoop in the other.
  ...layers([p('M30,51 L35,56 L33,50 Z')], { fill: front ? PALETTE.earInner : PALETTE.skinDark }),
  ...layers([front ? e(167, 66, 4.5, 5) : e(33, 66, 4.5, 5)], { stroke: PALETTE.gold, strokeWidth: 1.8 }),
  ...skin(both(LEG)),
  ...skin(both(TORSO)),
  ...skin(both(UPPER_ARM, FOREARM_SKIN)),
  // Underside of the upper arm and inner thighs in shadow.
  ...shade(both(p('M18,163 C28,165 42,162 54,157 L52,152 C40,157 28,159 18,158 Z'), p('M94,296 C98,278 99,262 100,246 L100,300 Z')), 0.22),
  ...layers([HEAD], { fill: 'url(#head)', stroke: PALETTE.outline, strokeWidth: 1.6 }),
  ...layers([MOHAWK], { fill: 'url(#hair)', stroke: PALETTE.outline, strokeWidth: 1.2 }),
  // Lighter strands in the mohawk.
  ...layers([p('M90,36 L88,24'), p('M96,33 L99,16'), p('M104,33 L101,16'), p('M110,36 L112,24')], {
    stroke: '#6B5C4C',
    strokeWidth: 0.9,
  }),
];

/** Soft shadow on the ground under the feet (drawn first). */
const GROUND_SHADOW: Layer[] = layers([e(100, 342, 62, 6)], { fill: '#000000', opacity: 0.3 });

const HANDS_AND_FEET = (front: boolean): Layer[] => [
  // Cloth wraps at the wrists, then fists by the ears with knuckle lines.
  ...layers(both(e(18, 104, 9.5, 4), e(19, 110, 9, 3.5)), { fill: PALETTE.wrap, stroke: PALETTE.outline, strokeWidth: 1 }),
  ...layers(both(p('M11,103 L14,106'), p('M16,102 L19,106'), p('M21,102 L24,106'), p('M12,109 L15,112'), p('M18,108 L21,112')), {
    stroke: '#A89A74',
    strokeWidth: 0.8,
  }),
  ...skin(both(e(19, 92, 12.5, 11))),
  ...layers(both(p('M10,89 C14,86 18,86 22,88'), p('M13,95 C17,93 22,93 27,95')), { stroke: PALETTE.line, strokeWidth: 1.2 }),
  // Knuckle highlights and dark claw-nails.
  ...layers(both(e(13, 86.5, 2, 1.2), e(19, 85.5, 2, 1.2), e(25, 86.5, 2, 1.2)), { fill: '#FFFFFF', opacity: 0.3 }),
  ...layers(both(e(12, 90.5, 1.6, 1), e(18, 90, 1.6, 1), e(24, 90.5, 1.6, 1)), { fill: PALETTE.dark, opacity: 0.6 }),
  // Bare feet; claws on the front, calloused soles on the back.
  ...skin(both(e(77, 338, 19, 8.5))),
  ...layers(both(p('M62,334 C70,331 84,331 92,334')), { stroke: '#FFFFFF', strokeWidth: 1.2, opacity: 0.25 }),
  ...(front
    ? layers(both(e(64, 343, 3, 2.2), e(72, 345, 3, 2.2), e(80, 345, 3, 2.2), e(88, 343, 3, 2.2)), { fill: PALETTE.tooth, stroke: PALETTE.outline, strokeWidth: 0.8 })
    : layers(both(e(77, 339, 8, 3.5)), { fill: PALETTE.skinDark })),
];

/** Belt with a gold buckle and a ragged leather loincloth flap. */
const BELT_AND_CLOTH = (front: boolean): Layer[] => [
  ...layers([p('M64,236 C78,242 122,242 136,236 L135,245 C122,250 78,250 65,245 Z')], {
    fill: 'url(#leather)',
    stroke: PALETTE.outline,
    strokeWidth: 1.2,
  }),
  // Stitching along the belt.
  ...layers([p('M68,240.5 C80,245.5 120,245.5 132,240.5')], { stroke: '#C9A57A', strokeWidth: 0.7, opacity: 0.7 }),
  ...layers([p('M92,246 C98,248 102,248 108,246 L110,262 L105,258 L101,265 L97,258 L92,263 L90,252 Z')], {
    fill: 'url(#leather)',
    stroke: PALETTE.outline,
    strokeWidth: 1.2,
  }),
  ...layers([p('M96,250 L95,258'), p('M101,250 L101,260'), p('M106,250 L106.5,257')], { stroke: PALETTE.leatherDark, strokeWidth: 0.8 }),
  ...(front
    ? [
        ...layers([box(94, 237.5, 106, 246.5, 1.5)], { fill: 'url(#gold)', stroke: PALETTE.outline, strokeWidth: 1 }),
        ...layers([box(97, 240, 103, 244, 1)], { fill: PALETTE.leatherDark }),
      ]
    : []),
];

const DELTOID = e(52, 144, 13, 12);
/** Shadow the head casts on the neck. */
const CHIN_SHADOW = shade([p('M82,123 C90,131 110,131 118,123 L118.6,126.5 C110,134 90,134 81.4,126.5 Z')], 0.35);
const FOREARM = e(16, 122, 8, 20, 6);
const NECK = p('M82,123 C90,131 110,131 118,123 L120,133 C110,139 90,139 80,133 Z');

// ---------- front ----------

export const CRITTER_FRONT: CritterView = {
  under: sharedUnder(true),
  parts: [
    {
      slug: 'neck',
      shapes: [NECK],
      // Chin shadow and a necklace of teeth.
      details: [
        ...CHIN_SHADOW,
        ...layers([p('M84,131 C92,137 108,137 116,131')], { stroke: PALETTE.leatherDark, strokeWidth: 1.2 }),
        ...layers([p('M90,134 L92,141 L94,135 Z'), p('M98,136 L100,144 L102,136 Z'), p('M106,135 L108,141 L110,134 Z')], {
          fill: PALETTE.tooth,
          stroke: PALETTE.outline,
          strokeWidth: 0.8,
        }),
      ],
    },
    { slug: 'trapezius', shapes: both(p('M80,131 C74,134 66,136 60,137 C68,140 77,139 85,135 Z')) },
    { slug: 'deltoids', shapes: both(DELTOID), details: shine(p('M45,139 C48,136 52,135 56,136')) },
    {
      slug: 'chest',
      shapes: both(p('M65,139 C59,147 57,157 60,166 C69,174 86,174 98,168 L98,140 C90,134 76,134 65,139 Z')),
      details: [
        ...shine(p('M68,147 C73,143 80,141 87,141')),
        // Shadow under the pecs.
        ...shade(both(p('M60,166 C69,174 86,174 98,168 L98,173 C86,179 69,179 60,170 Z')), 0.3),
      ],
    },
    {
      slug: 'biceps',
      shapes: both(e(31, 140, 15, 9.5, -6)),
      details: [
        ...shine(p('M22,136 C27,132 34,131 40,133')),
        ...layers(both(p('M20,143 C26,145 31,142 37,145 C40,147 43,146 45,144')), { stroke: PALETTE.line, strokeWidth: 0.8, opacity: 0.6 }),
      ],
    },
    {
      slug: 'forearm',
      shapes: both(FOREARM),
      details: layers(both(p('M14,109 C16,118 13,127 16,137')), { stroke: PALETTE.line, strokeWidth: 0.8, opacity: 0.6 }),
    },
    {
      slug: 'abs',
      shapes: both(box(88, 172, 98.5, 188), box(88, 191, 98.5, 207), box(88, 210, 98.5, 226), p('M88,229 L98.5,229 L98.5,244 C94,242 90,238 88,234 Z')),
      details: shade(both(p('M88,186 L98.5,186 L98.5,188 L88,188 Z'), p('M88,205 L98.5,205 L98.5,207 L88,207 Z'), p('M88,224 L98.5,224 L98.5,226 L88,226 Z')), 0.35),
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
    ...BELT_AND_CLOTH(true),
    // Face: warts, heavy brows, yellow eyes, hooked nose, toothy grin with tusks.
    ...layers([e(66, 96, 1.8, 1.8), e(131, 88, 1.5, 1.5), e(124, 58, 1.3, 1.3)], { fill: PALETTE.skinDark }),
    // Eye sockets in shadow, then glowing eyes.
    ...shade(both(e(80, 75, 13.5, 10.5, 12)), 0.3),
    ...layers(both(e(80, 76, 10.5, 8, 12)), { fill: 'url(#eye)', stroke: PALETTE.outline, strokeWidth: 1.4 }),
    ...layers(both(e(81, 77, 2.6, 6.2)), { fill: PALETTE.dark }),
    ...layers(both(e(78.5, 73.5, 1.8, 1.8)), { fill: '#FFFFFF' }),
    ...layers(both(p('M65,63 C73,57 84,58 93,67')), { stroke: PALETTE.skinDark, strokeWidth: 4 }),
    // Nose: shadow underneath, then the nose with a highlight down the bridge.
    ...shade([e(100, 104, 9, 3)], 0.3),
    ...layers([p('M100,70 C94,80 89,93 93,100 C97,105 104,105 107,100 C110,93 105,81 100,70 Z')], {
      fill: 'url(#skin)',
      stroke: PALETTE.outline,
      strokeWidth: 1.4,
    }),
    ...layers([p('M99,76 C97,84 95,91 96,97')], { stroke: '#FFFFFF', strokeWidth: 1.4, opacity: 0.35 }),
    // Cheekbone highlights and smile creases.
    ...layers(both(e(64, 88, 7, 3.5, -20)), { fill: '#FFFFFF', opacity: 0.12 }),
    ...layers(both(p('M70,100 C70,104 71,107 74,109')), { stroke: PALETTE.line, strokeWidth: 1, opacity: 0.6 }),
    ...layers([e(96, 99.5, 1.6, 1.2), e(104, 99.5, 1.6, 1.2)], { fill: PALETTE.dark }),
    ...layers([p('M73,105 C86,120 114,120 127,105 C114,112 86,112 73,105 Z')], {
      fill: PALETTE.dark,
      stroke: PALETTE.outline,
      strokeWidth: 1.2,
    }),
    ...layers([p('M88,110.5 L90,114 L92,111 Z'), p('M96,111.3 L98,115 L100,111.4 Z'), p('M104,111.2 L106,114.6 L108,110.8 Z')], {
      fill: PALETTE.tooth,
    }),
    ...layers(both(p('M80,112 L82.5,101 L86,113 Z')), { fill: PALETTE.tooth, stroke: PALETTE.outline, strokeWidth: 0.9 }),
    ...HANDS_AND_FEET(true),
  ],
};

// ---------- back ----------

export const CRITTER_BACK: CritterView = {
  under: sharedUnder(false),
  parts: [
    { slug: 'neck', shapes: [NECK], details: CHIN_SHADOW },
    {
      slug: 'trapezius',
      shapes: [p('M83,128 C75,132 66,134 58,138 C68,144 82,156 100,186 C118,156 132,144 142,138 C134,134 125,132 117,128 C110,131 90,131 83,128 Z')],
      details: layers([p('M100,140 L100,180')], { stroke: PALETTE.line, strokeWidth: 1 }),
    },
    { slug: 'deltoids', shapes: both(DELTOID), details: shine(p('M45,139 C48,136 52,135 56,136')) },
    {
      slug: 'upper-back',
      shapes: both(p('M57,150 C57,170 61,190 67,206 C77,202 89,196 96,187 C88,172 75,158 63,148 Z')),
      details: [
        ...shine(p('M62,160 C63,172 66,184 70,194')),
        ...shade(both(p('M96,187 C89,196 77,202 67,206 L69,210 C79,206 91,200 98,191 Z')), 0.3),
      ],
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
    ...BELT_AND_CLOTH(false),
    // The mohawk runs down the back of the head; a couple of warts and scars.
    ...layers([p('M94,38 C98,36 102,36 106,38 L105,62 L100,70 L95,62 Z')], { fill: PALETTE.hair, stroke: PALETTE.outline, strokeWidth: 1.2 }),
    ...layers([e(78, 92, 1.8, 1.8), e(126, 70, 1.5, 1.5)], { fill: PALETTE.skinDark }),
    ...layers([p('M118,96 L130,104'), p('M121,94 L119,99'), p('M125,97 L123,102'), p('M129,100 L127,105')], {
      stroke: PALETTE.skinDark,
      strokeWidth: 1.2,
    }),
    ...HANDS_AND_FEET(false),
  ],
};
