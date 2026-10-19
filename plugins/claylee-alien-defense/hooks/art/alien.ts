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
  S: 0x7d8bb0,
  T: 0xb5c3e0,
  s: 0x4a5578,
  b: 0x2a2f45,
  M: 0x6b7489,
  m: 0xd0d8e6,
  c: 0xff6ad5,
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
// The sleeping bag left on the ground after the alien jumps out of it.
const BAG_ROWS = ["..ooooooooo..", ".oqqqqYqqqqo.", "oQQQQQYQQQQQo"];

const parse = (rows: readonly string[]): Bitmap => parsePixelMap({ rows, palette: ALIEN_PALETTE });

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
  liftUp: parse(LIFT_UP_ROWS),
  liftDown: parse(LIFT_DOWN_ROWS),
  bag: parse(BAG_ROWS),
};
