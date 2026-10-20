import { parsePixelMap, replaceRows } from "../shared/pixel/sprite";
import type { Bitmap } from "../shared/pixel/bitmap";

export const ALIEN_PALETTE = {
  o: 0x0e1a14,
  a: 0xff6ad5,
  A: 0xc23aa0,
  G: 0x5bd16c,
  L: 0x9ff5a8,
  D: 0x2e8a45,
  w: 0xf4fff6,
  k: 0x10202a,
  e: 0x7a8296,
  E: 0x434958,
  S: 0x7d8bb0,
  T: 0xb5c3e0,
  s: 0x4a5578,
  b: 0x2a2f45,
  M: 0x6b7489,
  m: 0xd0d8e6,
  c: 0xff5a2a,
  n: 0xe8eef8,
  N: 0xaab4c8,
  q: 0xd8505a,
  Q: 0x8a2a35,
  Y: 0xf2c14e,
  B: 0xc3ccdb,
  P: 0x3a3f55,
  p: 0x8a93a8,
} as const;

const ANTENNA_UP = ["......a......", "......A......"];
const ANTENNA_SWAY = [".......a.....", "......A......"];
const EYES_OPEN = ["..oGwwGwwGo..", "..oGwkGwkGo.."];
const EYES_SHUT = ["..oGGGGGGGo..", "..oGooGooGo.."];

// The ray gun: a lit housing over an energy cell (`c`, recolored by state in the scene),
// a ribbed barrel and an emitter tip (`a`), held by the grip under the housing.
const BODY = [
  "....ooooo........",
  "...oLLGGGo.......",
  "..oLGGGGGGo......",
  ...EYES_OPEN.map((row) => row.padEnd(17, ".")),
  "..oDGGGGGDo......",
  "...oDDDDDo.......",
  "...oTTSSo.ooooo..",
  "..oTSSsoGoBmmmMoa",
  "..osSSsoGoccccoNa",
  "...os.os.oPooooo.",
  "..obb.obb.oo.....",
];

function standing(antenna: readonly string[], eyes: readonly string[]): string[] {
  return [
    ...antenna.map((row) => row.padEnd(17, ".")),
    ...replaceRows({
      rows: BODY,
      replacements: {
        [(EYES_OPEN[0] ?? "").padEnd(17, ".")]: (eyes[0] ?? "").padEnd(17, "."),
        [(EYES_OPEN[1] ?? "").padEnd(17, ".")]: (eyes[1] ?? "").padEnd(17, "."),
      },
    }),
  ];
}

const FLEX_RIGHT_ROWS = [
  "....a..........",
  "....A..........",
  "...ooooo.......",
  "..oLLGGGo...ooo",
  ".oLGGGGGGo.oLGo",
  ".oGGGGwwGo.oGGo",
  ".oGGGGwkGo.oGGo",
  ".oDGGGGGDo.oGGo",
  "..oDDDDDooGGGGo",
  "...oTTSSSooooo.",
  "...oTSSSSo.....",
  "...osSSso......",
  "...os.os.......",
  "..obb.obb......",
];

const FLEX_RIGHT_PUMP_ROWS = replaceRows({
  rows: FLEX_RIGHT_ROWS,
  replacements: {
    ".oGGGGwwGo.oGGo": ".oGGGGGGGo.oLLo",
    ".oGGGGwkGo.oGGo": ".oGGGGooGooLoGo",
    ".oDGGGGGDo.oGGo": ".oDGGGwwDoLLLGo",
    "..oDDDDDooGGGGo": "..oDDDDDoLGGGGo",
  },
});

const LUNGE_LEGS = ["..osSSSsssso...", ".os.......oso..", "obb.......obbo."];

const FLEX_RIGHT_LUNGE_ROWS = [
  "...............",
  ...FLEX_RIGHT_PUMP_ROWS.slice(0, 10),
  ...LUNGE_LEGS,
];

const mirror = (rows: readonly string[]): string[] =>
  rows.map((row) => Array.from(row).reverse().join(""));

export const FLEX_SHIFT_X = { right: 1, left: -2 } as const;

const SLEEP_ROWS = [
  "..ooooo...............",
  ".oLGGGGo....oooooooo..",
  "oLGooGooGo.oqqYqqqqqo.",
  "oGGGGGGGGoqqqYqqqqqqqo",
  "nnoDDDDDoqqqqYqqqqqQQo",
  "nNNooooooQQQQYQQQQQQo.",
  ".NNNNNNN.oooooooooooo.",
];

const SLEEP_BREATH_ROWS = replaceRows({
  rows: SLEEP_ROWS,
  replacements: {
    "..ooooo...............": "..ooooo.....ooooooo...",
    ".oLGGGGo....oooooooo..": ".oLGGGGo...oqqqqqqqo..",
  },
});

// Rolled over in the bag: the back of the head, no face and no bubble.
const facingAway = (rows: readonly string[]): string[] =>
  replaceRows({ rows, replacements: { "oLGooGooGo.oqqYqqqqqo.": "oLGGGGGGDo.oqqYqqqqqo." } });
const LIFT_UP_ROWS = [
  "PP...........PP",
  "PpBBBBBBBBBBBpP",
  "PP.Gs.....sG.PP",
  "...os.....so...",
  "...oSooooooSo..",
  "...oLLLGGGGo...",
  "...oGwwGwwGo...",
  "...oGwkGwkGo...",
  "...oDGGGGGDo...",
  "....oDDDDDo....",
  "....oTTSSo.....",
  "....osSSso.....",
  "....os.os......",
  "...obb.obb.....",
];

const LIFT_DOWN_ROWS = [
  "...............",
  ".......a.......",
  "....ooooooo....",
  "...oLLLGGGGo...",
  "...oGwwGwwGo...",
  "...oGwkGwkGo...",
  "...oDGGGGGDo...",
  "PP..oDDDDDo..PP",
  "PpBBBBBBBBBBBpP",
  "PP.GoTTSSoG..PP",
  "....oSSSSo.....",
  "...osS..Sso....",
  "..os......so...",
  ".obb......bbo..",
];
// The bar bends under the plates for a beat when it locks out.
const LIFT_BOUNCE_ROWS = [
  "...............",
  "PP.BBBBBBBBB.PP",
  "PpBGs.....sGBpP",
  "PP.os.....so.PP",
  ...LIFT_UP_ROWS.slice(4),
];

// Halfway up the bar passes the brow, elbows out.
const LIFT_PRESS_ROWS = [
  "...............",
  "...............",
  ".......a.......",
  ".......A.......",
  "PP.ooooooooo.PP",
  "PpBBBBBBBBBBBpP",
  "PPGoGwwGwwGoGPP",
  "..GoGwkGwkGoG..",
  "..GoDGGGGGDoG..",
  "...soDDDDDos...",
  ...LIFT_UP_ROWS.slice(10),
];

const LIFT_STRAIN_ROWS = replaceRows({
  rows: LIFT_PRESS_ROWS,
  replacements: {
    "PPGoGwwGwwGoGPP": "PPGoGGGGGGGoGPP",
    "..GoGwkGwkGoG..": "..GoGooGooGoG..",
    "..GoDGGGGGDoG..": "..GoDGwwwGDoG..",
  },
});

// Standing with the arms hanging and no gun, for the breaths between flex poses.
const STAND_BARE_ROWS = [
  ".......a.......",
  ".......A.......",
  ".....ooooo.....",
  "....oLLGGGo....",
  "...oLGGGGGGo...",
  "...oGwwGwwGo...",
  "...oGwkGwkGo...",
  "...oDGGGGGDo...",
  "....oDDDDDo....",
  "...GoTTSSoG....",
  "...GoTSSSoG....",
  "...GosSSsoG....",
  "....os.os......",
  "...obb.obb.....",
];

// The bar set down in front between sets, mouth open while catching breath.
const LIFT_REST_ROWS = [
  ...STAND_BARE_ROWS.slice(0, 11),
  "PP.GosSSsoG..PP",
  "PpBBBBBBBBBBBpP",
  "PP.obb.obb...PP",
];

const LIFT_PANT_ROWS = replaceRows({
  rows: LIFT_REST_ROWS,
  replacements: { "...oDGGGGGDo...": "...oDGGoGGDo..." },
});

// Front double biceps: both fists up, head between them.
const FLEX_FRONT_ROWS = [
  ".........a.........",
  ".........A.........",
  "ooo....ooooo....ooo",
  "oGLo..oLLGGGo..oLGo",
  "oGGo.oLGGGGGGo.oGGo",
  "oGGo.oGwwGwwGo.oGGo",
  "oGGo.oGwkGwkGo.oGGo",
  "oGGo.oDGGGGGDo.oGGo",
  "oGGGGGoDDDDDoGGGGGo",
  ".ooooooTTSSSoooooo.",
  "......oTSSSSo......",
  "......osSSso.......",
  "......os.os........",
  ".....obb.obb.......",
];

// Under tension the biceps peak catches the light, eyes squeeze and the alien grins.
const FLEX_FRONT_PUMP_ROWS = replaceRows({
  rows: FLEX_FRONT_ROWS,
  replacements: {
    "oGGo.oLGGGGGGo.oGGo": "oLLo.oLGGGGGGo.oLLo",
    "oGGo.oGwwGwwGo.oGGo": "oGLo.oGGGGGGGo.oLGo",
    "oGGo.oGwkGwkGo.oGGo": "oLGo.oGooGooGo.oGLo",
    "oGGo.oDGGGGGDo.oGGo": "oGGo.oDGwwwGDo.oGGo",
  },
});

export const FLEX_FRONT_SHIFT_X = -2;

// The sleeping bag left on the ground after the alien jumps out of it.
const BAG_ROWS = ["..ooooooooo..", ".oqqqqYqqqqo.", "oQQQQQYQQQQQo"];

// Both arms up and grinning, for the stats party.
const CHEER_ROWS = [
  ".......a.......",
  ".L.....A.....L.",
  ".G...ooooo...G.",
  ".G..oLLGGGo..G.",
  "..GoLGGGGGGoG..",
  "..GoGwwGwwGoG..",
  "..GoGwkGwkGoG..",
  "..GoDGwwwGDoG..",
  "...GoDDDDDoG...",
  "....oTTSSo.....",
  "....oTSSSo.....",
  "....osSSso.....",
  "....os.os......",
  "...obb.obb.....",
];

// The hands swing out on the other beat of the wave.
const CHEER_WAVE_ROWS = replaceRows({
  rows: CHEER_ROWS,
  replacements: { ".L.....A.....L.": "L......A......L" },
});

// Pupils up, watching the UFO come in.
const lookingUp = (rows: readonly string[]): string[] =>
  replaceRows({
    rows,
    replacements: {
      "..GoGwwGwwGoG..": "..GoGwkGwkGoG..",
      "..GoGwkGwkGoG..": "..GoGwwGwwGoG..",
    },
  });

// Knees bent: the shins (row 12 of a standing sprite) fold away, so the alien stands a pixel lower.
const crouched = (rows: readonly string[]): string[] => rows.filter((_, row) => row !== 12);

// A green antenna: the one drawn above the head (`a` tip over `A` stalk) takes the skin's light
// and base greens. Only rows above the head's outline change, since `a` also paints the gun's emitter.
function greenAntenna(rows: readonly string[]): string[] {
  const head = rows.findIndex((row) => row.includes("o"));
  return rows.map((row, index) => (index >= head ? row : row.replace(/a/g, "L").replace(/A/g, "G")));
}

// Gray eyes, no white or pupil: each eye is the 2×2 block around a pupil `k`, the white beside
// it (either side, as mirrored poses flip it) and the row of white over it (under it when looking
// up). The block turns gray (`e`) and the pupil's cell a darker gray (`E`), so the gaze still
// reads. The grin's teeth (`w`) stay white.
function grayEyes(rows: readonly string[]): string[] {
  const cells = rows.map((row) => Array.from(row));
  rows.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => {
      if (cell !== "k") return;
      const left = row[x - 1] === "w" ? x - 1 : row[x + 1] === "w" ? x : undefined;
      if (left === undefined) return;
      const other = rows[y - 1]?.slice(left, left + 2) === "ww" ? y - 1 : y + 1;
      if (rows[other]?.slice(left, left + 2) !== "ww") return;
      for (const at of [y, other]) for (const column of [left, left + 1]) cells[at]![column] = "e";
      cells[y]![x] = "E";
    });
  });
  return cells.map((row) => row.join(""));
}

const parse = (rows: readonly string[]): Bitmap =>
  parsePixelMap({ rows: grayEyes(greenAntenna(rows)), palette: ALIEN_PALETTE });

export const MUZZLE_X = 17;
export const MUZZLE_Y = 10;
// Where the scene repaints the gun by state, in sprite coordinates.
export const GUN_CELLS = [10, 11, 12, 13].map((x) => ({ x, y: 11 }));
export const GUN_TIP = [
  { x: 16, y: 10 },
  { x: 16, y: 11 },
];

export const ALIEN = {
  stand: parse(standing(ANTENNA_UP, EYES_OPEN)),
  sway: parse(standing(ANTENNA_SWAY, EYES_OPEN)),
  blink: parse(standing(ANTENNA_UP, EYES_SHUT)),
  flexRight: parse(FLEX_RIGHT_ROWS),
  flexRightPump: parse(FLEX_RIGHT_LUNGE_ROWS),
  flexLeft: parse(mirror(FLEX_RIGHT_ROWS)),
  flexLeftPump: parse(mirror(FLEX_RIGHT_LUNGE_ROWS)),
  sleep: parse(SLEEP_ROWS),
  sleepBreath: parse(SLEEP_BREATH_ROWS),
  sleepAway: parse(facingAway(SLEEP_ROWS)),
  sleepAwayBreath: parse(facingAway(SLEEP_BREATH_ROWS)),
  liftUp: parse(LIFT_UP_ROWS),
  liftDown: parse(LIFT_DOWN_ROWS),
  liftBounce: parse(LIFT_BOUNCE_ROWS),
  liftPress: parse(LIFT_PRESS_ROWS),
  liftStrain: parse(LIFT_STRAIN_ROWS),
  liftRest: parse(LIFT_REST_ROWS),
  liftPant: parse(LIFT_PANT_ROWS),
  standBare: parse(STAND_BARE_ROWS),
  flexFront: parse(FLEX_FRONT_ROWS),
  flexFrontPump: parse(FLEX_FRONT_PUMP_ROWS),
  cheer: parse(CHEER_ROWS),
  cheerWave: parse(CHEER_WAVE_ROWS),
  cheerCrouch: parse(crouched(CHEER_ROWS)),
  cheerUp: parse(lookingUp(CHEER_ROWS)),
  cheerWaveUp: parse(lookingUp(CHEER_WAVE_ROWS)),
  bag: parse(BAG_ROWS),
};
