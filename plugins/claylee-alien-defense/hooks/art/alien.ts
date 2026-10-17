import { parsePixelMap, replaceRows } from "../shared/pixel/sprite";
import type { Bitmap } from "../shared/pixel/bitmap";

export const ALIEN_PALETTE = {
  a: 0xff5fd2,
  G: 0x6ee07a,
  g: 0x2f8f45,
  w: 0xf4fff6,
  k: 0x10202a,
  S: 0x8d9bb8,
  s: 0x56627e,
  b: 0x343a52,
  m: 0xc3ccdb,
  M: 0x6b7489,
  f: 0x6ee07a,
} as const;

const EYES_OPEN = "..GwkGwkG...";
const EYES_SHUT = "..GkkGkkG...";

const STAND_ROWS = [
  ".....a......",
  ".....G......",
  "...GGGGG....",
  "..GwwGwwG...",
  EYES_OPEN,
  "..GGGGGGG...",
  "...GgggG....",
  "...SSSSS....",
  "..SSsSSSmmmm",
  "..S.sSSSMM..",
  "....sss.....",
  "...b...b....",
  "..bb...bb...",
];

const FLEX_ROWS = [
  "......a.......",
  "......G.......",
  "ff..GGGGG..ff.",
  "SS.GwwGwwG.SS.",
  "SS.GwkGwkG.SS.",
  ".SSGGGGGGGSS..",
  "..SSGgggGSS...",
  "....SSSSS.....",
  "....SsSSS.....",
  "....SsSSS.....",
  ".....sss......",
  "....b...b.....",
  "...bb...bb....",
];

const FLEX_PUMP_ROWS = replaceRows({
  rows: FLEX_ROWS,
  replacements: {
    "ff..GGGGG..ff.": "fff.GGGGG.fff.",
    "SS.GwkGwkG.SS.": "SS.GkkGkkG.SS.",
  },
});

const SLEEP_ROWS = [
  "..GGG.........",
  ".GkGGGSSSSSb..",
  "aGGgGGSsSSSbb.",
  ".GGGGGSSSSSb..",
  "..GGG.........",
];

const SLEEP_BREATH_ROWS = replaceRows({
  rows: SLEEP_ROWS,
  replacements: { "..GGG.........": "..GGG..SSS...." },
});

const PUSHUP_UP_ROWS = [
  "..........GG..",
  ".........GwkG.",
  "bbSSSSSSSGGGG.",
  ".......S..S...",
  ".......S..S...",
];

const PUSHUP_DOWN_ROWS = [
  "..............",
  "..........GG..",
  ".........GwkG.",
  "bbSSSSSSSGGGG.",
  ".......SS.SS..",
];

const parse = (rows: readonly string[]): Bitmap => parsePixelMap({ rows, palette: ALIEN_PALETTE });

export const ALIEN = {
  stand: parse(STAND_ROWS),
  blink: parse(replaceRows({ rows: STAND_ROWS, replacements: { [EYES_OPEN]: EYES_SHUT } })),
  flex: parse(FLEX_ROWS),
  flexPump: parse(FLEX_PUMP_ROWS),
  sleep: parse(SLEEP_ROWS),
  sleepBreath: parse(SLEEP_BREATH_ROWS),
  pushupUp: parse(PUSHUP_UP_ROWS),
  pushupDown: parse(PUSHUP_DOWN_ROWS),
};
