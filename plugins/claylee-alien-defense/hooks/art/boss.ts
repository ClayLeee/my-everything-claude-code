import { parsePixelMap } from "../shared/pixel/sprite";
import type { FrameSet } from "../shared/pixel/sprite";
import type { Phase } from "../sim/types";

export const BOSS_CORE = 0x7cfc9a;

const PALETTE = {
  o: 0x14051f,
  O: 0x3d1a5c,
  p: 0x7a3db8,
  L: 0xa970e8,
  h: 0xd9b8ff,
  w: 0xfff3b0,
  k: 0x1a0612,
  r: 0xe0304a,
  R: 0x8a1028,
  t: 0xffffff,
  x: 0x5a2a86,
  X: 0x9b59d0,
  g: BOSS_CORE,
} as const;

export const BOSS_WIDTH = 20;

const HEAD = [
  ".......oooooo.......",
  ".....ooLLhhLLoo.....",
  "....oLLhLLLLLpOo....",
  "...oLLwwLLLLwwLpOo..",
  "..oLLwkkwLLwkkwLpOo.",
  "..oLpwwwLgLLwwwppOo.",
  ".oLppppppppppppppOo.",
  ".oLpRrrrrrrrrrRpOo..",
  ".oppRtRtRtRtRtRRpOo.",
  ".oppRrrrrrrrrrRppOo.",
  "..oOpppppppppppOOo..",
  "...ooOOOOOOOOOOoo...",
];

const TENTACLES_A = ["..xX.xX.xXXx.Xx.Xx..", ".x..x...x..x...x..x."];
const TENTACLES_B = ["...Xx.Xx.xXXx.xX.xX.", "..x...x..xx..x...x.."];

export const BOSS_FRAMES: FrameSet = [
  parsePixelMap({ rows: [...HEAD, ...TENTACLES_A], palette: PALETTE }),
  parsePixelMap({ rows: [...HEAD, ...TENTACLES_B], palette: PALETTE }),
];

export const BOSS_TITLES: Record<Phase, string> = {
  dawn: "吞噬者",
  noon: "母巢",
  dusk: "幽影王",
  night: "深淵獸",
};
