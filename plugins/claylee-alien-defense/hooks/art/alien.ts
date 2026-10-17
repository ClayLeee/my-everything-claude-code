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

const BODY = [
  "....ooooo....",
  "...oLLGGGo...",
  "..oLGGGGGGo..",
  ...EYES_OPEN,
  "..oDGGGGGDo..",
  "...oDDDDDo...",
  "...oTTSSo....",
  "..oTSSsoMmmmc",
  "..osSSsoM....",
  "...os.os.....",
  "..obb.obb....",
];

function standing(antenna: readonly string[], eyes: readonly string[]): string[] {
  return [
    ...antenna,
    ...replaceRows({
      rows: BODY,
      replacements: { [EYES_OPEN[0] ?? ""]: eyes[0] ?? "", [EYES_OPEN[1] ?? ""]: eyes[1] ?? "" },
    }),
  ];
}

const FLEX_ROWS = [
  ".......a.......",
  ".......A.......",
  "oLo..ooooo..oLo",
  "oGGooLLGGGooGGo",
  ".oToLGGGGGGoTo.",
  "..ooGwwGwwGoo..",
  "...oGwkGwkGo...",
  "...oDGGGGGDo...",
  "....oDDDDDo....",
  "...oTTSSSTo....",
  "...oTSSSSSo....",
  "....osSSso.....",
  "....os.os......",
  "...obb.obb.....",
];

const FLEX_PUMP_ROWS = replaceRows({
  rows: FLEX_ROWS,
  replacements: {
    "oLo..ooooo..oLo": "oLLo.ooooo.oLLo",
    oGGooLLGGGooGGo: "oGGGoLLGGGoGGGo",
    "..ooGwwGwwGoo..": "..ooGGGGGGGoo..",
    "...oGwkGwkGo...": "...oGooGooGo...",
  },
});

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
const parse = (rows: readonly string[]): Bitmap => parsePixelMap({ rows, palette: ALIEN_PALETTE });

export const MUZZLE_X = 13;
export const MUZZLE_Y = 10;

export const ALIEN = {
  stand: parse(standing(ANTENNA_UP, EYES_OPEN)),
  sway: parse(standing(ANTENNA_SWAY, EYES_OPEN)),
  blink: parse(standing(ANTENNA_UP, EYES_SHUT)),
  flex: parse(FLEX_ROWS),
  flexPump: parse(FLEX_PUMP_ROWS),
  sleep: parse(SLEEP_ROWS),
  sleepBreath: parse(SLEEP_BREATH_ROWS),
  liftUp: parse(LIFT_UP_ROWS),
  liftDown: parse(LIFT_DOWN_ROWS),
};
