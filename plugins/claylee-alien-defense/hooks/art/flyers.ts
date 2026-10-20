import type { Color } from "../shared/pixel/bitmap";

// Things that cross the night sky in free mode. `L` cells are lights the scene recolors.
export const UFO_ROWS = ["...ddd...", "..dGGGd..", "oMMMMMMMo", ".oLoLoLo."];
export const SATELLITE_ROWS = ["pp.r.pp", "ppoMopp", "pp...pp"];

// The same UFO up close, when it visits the alien (session start, `/alien stats`): a size up,
// with a belly hatch (`h`) the scene opens from the middle out.
export const VISIT_UFO_ROWS = [
  "...ddddddd...",
  "..dGGGGGGGd..",
  "oMMMMMMMMMMMo",
  ".oLoLoLoLoLo.",
  "....ohhho....",
];
export const VISIT_UFO_WIDTH = 13;

export const FLYER_COLORS: Readonly<Record<string, Color>> = {
  o: 0x1a1e2c,
  d: 0x5d6684,
  G: 0x7cfc9a,
  M: 0x9aa6c4,
  p: 0x4a7ad9,
  r: 0xff4d6d,
};

export const UFO_LIGHTS: readonly Color[] = [0xff4d6d, 0xffe066, 0x6fd6ff];
export const COMET_TAIL: readonly Color[] = [0xffffff, 0xfff3b0, 0xa9b3d9, 0x7a7fae, 0x5a5f8a, 0x3a3d66];
