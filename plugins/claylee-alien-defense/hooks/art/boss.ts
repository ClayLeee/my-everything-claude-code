import { parsePixelMap } from "../shared/pixel/sprite";
import type { FrameSet } from "../shared/pixel/sprite";
import type { Phase } from "../sim/types";

const PALETTE = {
  O: 0x3d1a5c,
  o: 0x7a3db8,
  h: 0xa970e8,
  w: 0xfff3b0,
  k: 0x1a0612,
  r: 0xe0304a,
  t: 0xffffff,
  x: 0x5a2a86,
} as const;

const WIDTH = 18;

function line(parts: string): string {
  if (parts.length !== WIDTH) {
    throw new Error(`boss row "${parts}" is ${parts.length} wide, expected ${WIDTH}`);
  }
  return parts;
}

const HEAD = [
  line("......OOOOOO......"),
  line("....OOooooooOO...."),
  line("...Oohhhhhhhhoo..."),
  line("..Oooowwoowwoooo.."),
  line("..Ooowkkoookkwoo.."),
  line(".Ooooowwoowwooooo."),
  line(".Oooooooooooooooo."),
  line(".Ooorrrrrrrrrrooo."),
  line(".Ooortrtrtrtrtooo."),
  line("..Oooorrrrrrooooo."),
  line("...OOooooooooOO..."),
];

const TENTACLES_A = [line("..x..x..xx..x..x.."), line(".x..x..x..x..x..x.")];
const TENTACLES_B = [line("...x..x.xx.x..x..."), line("..x..x..xx..x..x..")];

export const BOSS_FRAMES: FrameSet = [
  parsePixelMap({ rows: [...HEAD, ...TENTACLES_A], palette: PALETTE }),
  parsePixelMap({ rows: [...HEAD, ...TENTACLES_B], palette: PALETTE }),
];

export const BOSS_WIDTH = WIDTH;

export const BOSS_TITLES: Record<Phase, string> = {
  dawn: "規格吞噬者",
  noon: "任務蠶食母巢",
  dusk: "驗證幽影王",
  night: "歸檔深淵獸",
};
