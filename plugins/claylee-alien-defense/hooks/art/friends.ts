import { parsePixelMap } from "../shared/pixel/sprite";
import type { Bitmap, Color } from "../shared/pixel/bitmap";

// The alien's friends who drop in for `/alien stats`: a robot beamed down beside it and a
// three-eyed furball waving from the UFO's top hatch.
export const FRIEND_PALETTE: Readonly<Record<string, Color>> = {
  o: 0x1a1e2c,
  S: 0x9aa6c4,
  L: 0xe6ecff,
  B: 0x5d6684,
  c: 0xffe066,
  e: 0x6fd6ff,
  m: 0x7cfc9a,
  r: 0xff4d6d,
  f: 0xb07cff,
  F: 0x7a4dc8,
  w: 0xf4fff6,
  k: 0x10202a,
};

// LED eyes and mouth on a boxy head, a lit chest light, an antenna lamp (`r`) the scene blinks.
const ROBOT_ROWS = [
  "...r...",
  "...o...",
  ".ooooo.",
  ".oSSSo.",
  ".oeSeo.",
  ".oSmSo.",
  "..ooo..",
  "SoBcBoS",
  "SoBBBoS",
  ".oo.oo.",
];

// The near arm straight up for the high-five, its hand level with the alien's.
const ROBOT_HIGH_FIVE_ROWS = [
  "L..r...",
  "S..o...",
  "Sooooo.",
  "SoSSSo.",
  "SoeSeo.",
  "SoSmSo.",
  "S.ooo..",
  ".oBcBoS",
  ".oBBBoS",
  ".oo.oo.",
];

// The arm cocked back by the head before the slap.
const ROBOT_WINDUP_ROWS = [
  "...r...",
  "...o...",
  ".ooooo.",
  "LoSSSo.",
  "SoeSeo.",
  "SoSmSo.",
  "S.ooo..",
  "SoBcBoS",
  ".oBBBoS",
  ".oo.oo.",
];

// Squashed on take-off and landing: the neck (row 6) folds away.
const crouched = (rows: readonly string[]): string[] => rows.filter((_, row) => row !== 6);

// Head and three eyes poking out of the top hatch; the rest of it stays inside.
export const FURBALL_ROWS = [".f.fFf.f.", "fFfffffFf", "ffwfwfwff", "ffkfkfkff"];
export const FURBALL_BLINK_ROWS = [".f.fFf.f.", "fFfffffFf", "fffffffff", "ffFfFfFff"];
export const FURBALL_WIDTH = 9;

// Bigger than the UFO that crosses the sky, with a top hatch for the furball and a belly
// hatch (`h`) the scene opens from the middle out. `L` cells are rim lights it recolors.
export const PARTY_UFO_ROWS = [
  "...ddddddd...",
  "..dGGGGGGGd..",
  "oMMMMMMMMMMMo",
  ".oLoLoLoLoLo.",
  "....ohhho....",
];
export const PARTY_UFO_WIDTH = 13;
// Where the antenna lamp sits in the robot sprite.
export const ROBOT_LAMP = { x: 3, y: 0 };

export const CONFETTI: readonly Color[] = [0xff4d6d, 0xffe066, 0x6fd6ff, 0x7cfc9a, 0xff6ad5];

const parse = (rows: readonly string[]): Bitmap => parsePixelMap({ rows, palette: FRIEND_PALETTE });

export const ROBOT = {
  idle: parse(ROBOT_ROWS),
  crouch: parse(crouched(ROBOT_ROWS)),
  windup: parse(crouched(ROBOT_WINDUP_ROWS)),
  highFive: parse(ROBOT_HIGH_FIVE_ROWS),
};
