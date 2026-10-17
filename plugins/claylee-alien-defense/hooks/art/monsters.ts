import { parsePixelMap } from "../shared/pixel/sprite";
import type { FrameSet } from "../shared/pixel/sprite";
import type { MonsterKind } from "../sim/types";

const SLIME_PALETTE = {
  o: 0x0b2b30,
  c: 0x4fd6d6,
  L: 0xaafaf5,
  h: 0xffffff,
  d: 0x1f8a96,
  w: 0xffffff,
  k: 0x0b1a1f,
} as const;
const WORM_PALETTE = {
  o: 0x3a0a10,
  r: 0xff6b5e,
  L: 0xffb0a0,
  d: 0xa8322b,
  w: 0xfff4ee,
  i: 0x2b8cff,
  k: 0x0a0a1a,
} as const;
const MOTH_PALETTE = {
  o: 0x2a0a26,
  m: 0xf27ad8,
  L: 0xffc2f0,
  d: 0xb03a96,
  P: 0x8e3fb8,
  p: 0xb07cf0,
  y: 0xfff27a,
} as const;
const SQUID_PALETTE = {
  o: 0x1f0b33,
  p: 0xb07cf0,
  L: 0xd9b8ff,
  d: 0x6a3fa6,
  w: 0xffffff,
  k: 0x14061f,
} as const;

const SLIME: FrameSet = [
  parsePixelMap({
    rows: [
      "....oooo....",
      "..ooLLccoo..",
      ".oLhLccccdo.",
      ".oLwkccwkcdo",
      "oLccccccccdo",
      "occcdddcccdo",
      "oddddddddddo",
      ".oooooooooo.",
    ],
    palette: SLIME_PALETTE,
  }),
  parsePixelMap({
    rows: [
      "............",
      "...oooooo...",
      ".ooLLhcccoo.",
      "oLLwkccwkcdo",
      "oLccccccccdo",
      "occcdddcccdo",
      "oddddddddddo",
      "oooooooooooo",
    ],
    palette: SLIME_PALETTE,
  }),
];

const WORM_BODY = [
  "....ooooo....",
  "..ooLLrrroo..",
  ".oLwwwwwwwro.",
  "oLwwwiiiwwwro",
  "orwwwikiwwwdo",
  ".orwwwwwwwdo.",
  "..oorrrddoo..",
];
const EYEWORM: FrameSet = [
  parsePixelMap({ rows: [...WORM_BODY, ".od.od.od.od."], palette: WORM_PALETTE }),
  parsePixelMap({ rows: [...WORM_BODY, "..do.do.do.do"], palette: WORM_PALETTE }),
];

const MOTH: FrameSet = [
  parsePixelMap({
    rows: [
      "oo.........oo",
      "oLo.......oLo",
      "oLmo.o.o.omLo",
      "omLmoPpPomLmo",
      ".omdoPyPodmo.",
      "..oo.oPo.oo..",
      ".....oPo.....",
      "......o......",
      ".............",
    ],
    palette: MOTH_PALETTE,
  }),
  parsePixelMap({
    rows: [
      ".............",
      ".....o.o.....",
      "...ooPpPoo...",
      ".oomLPyPLmoo.",
      "oLmmdoPodmmLo",
      "oLmdooPoodmLo",
      ".ooo.oPo.ooo.",
      "......o......",
      ".............",
    ],
    palette: MOTH_PALETTE,
  }),
];

const SQUID_HEAD = [
  "...ooooo...",
  "..oLLpppo..",
  ".oLpppppdo.",
  "oLwkppwkpdo",
  "oppppppppdo",
  ".odpdpdpdo.",
];
const SQUID: FrameSet = [
  parsePixelMap({
    rows: [...SQUID_HEAD, "od.pd.dp.do", ".o.p.d.p.o.", "..o.o.o.o.."],
    palette: SQUID_PALETTE,
  }),
  parsePixelMap({
    rows: [...SQUID_HEAD, ".do.pd.d.od", "o.p.d..p.o.", ".o..o.o..o."],
    palette: SQUID_PALETTE,
  }),
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
