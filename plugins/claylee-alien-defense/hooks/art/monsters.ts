import { parsePixelMap } from "../shared/pixel/sprite";
import type { FrameSet } from "../shared/pixel/sprite";
import type { MonsterKind } from "../sim/types";

const PALETTE = {
  c: 0x4fd6d6,
  C: 0x1f8a96,
  r: 0xff6b5e,
  R: 0xa8322b,
  m: 0xf27ad8,
  P: 0x8e3fb8,
  p: 0xb07cf0,
  Q: 0x6a3fa6,
  w: 0xffffff,
  k: 0x1b0f24,
} as const;

const parse = (rows: readonly string[]) => parsePixelMap({ rows, palette: PALETTE });

const SLIME: FrameSet = [
  parse(["...cccc...", "..cccccc..", ".ccwkcwkcc", "cccccccccc", ".C.CC.C.C."]),
  parse(["..........", "..cccccc..", ".ccwkcwkcc", "cccccccccc", "CCCCCCCCCC"]),
];

const EYEWORM_BODY = [
  "....rrrr....",
  "..rrwwwwrr..",
  ".rrwwkkwwrr.",
  ".rrwwkkwwrr.",
  "..rrwwwwrr..",
];
const EYEWORM: FrameSet = [
  parse([...EYEWORM_BODY, ".R.R.RR.R.R."]),
  parse([...EYEWORM_BODY, "..R.R..R.R.."]),
];

const MOTH: FrameSet = [
  parse([
    "m.........m",
    "mm.......mm",
    "mmm.p.p.mmm",
    ".mmmPPPmmm.",
    "..mmPwPmm..",
    "....PPP....",
    ".....p.....",
  ]),
  parse([
    "...........",
    "....p.p....",
    ".mmmPPPmmm.",
    "mmmmPwPmmmm",
    "mm..PPP..mm",
    "m....p....m",
    "...........",
  ]),
];

const SQUID_HEAD = ["...pppp...", "..pppppp..", ".ppwkpwkp.", ".pppppppp.", "..pQpQpQ.."];
const SQUID: FrameSet = [
  parse([...SQUID_HEAD, ".p.p..p.p.", "p..p..p..p"]),
  parse([...SQUID_HEAD, "..p.pp.p..", ".p..pp..p."]),
];

export const MONSTER_FRAMES: Record<MonsterKind, FrameSet> = {
  slime: SLIME,
  eyeworm: EYEWORM,
  moth: MOTH,
  squid: SQUID,
};

export const MONSTER_NAMES: Record<MonsterKind, string> = {
  slime: "黏液獸",
  eyeworm: "眼球蟲",
  moth: "孢子蛾",
  squid: "觸手怪",
};

export const DEATH_GLOW: Record<MonsterKind, number> = {
  slime: 0x4fd6d6,
  eyeworm: 0xff6b5e,
  moth: 0xf27ad8,
  squid: 0xb07cf0,
};
