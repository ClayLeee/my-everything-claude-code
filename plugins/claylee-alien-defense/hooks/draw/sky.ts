import { setPixel } from "../shared/pixel/bitmap";
import type { Bitmap, Color } from "../shared/pixel/bitmap";
import { lerp, mixColors } from "../shared/pixel/colors";
import { FLOOR_TOP, STAGE_HEIGHT } from "../sim/constants";
import type { Mode, Phase } from "../sim/types";

export type SkyStyle = {
  ground: Color;
  groundShade: Color;
  crystal: Color;
  sun: Color;
  sunX: number;
  sunY: number;
  sunAmount: number;
  moonAmount: number;
  starAmount: number;
};

const NIGHT: SkyStyle = {
  ground: 0x3a2a5c,
  groundShade: 0x22183a,
  crystal: 0x7f6cff,
  sun: 0xffc36b,
  sunX: 0.5,
  sunY: 12,
  sunAmount: 0,
  moonAmount: 1,
  starAmount: 1,
};

const PHASES: Record<Phase, SkyStyle> = {
  dawn: {
    ground: 0x8a4f6e,
    groundShade: 0x5a2f4a,
    crystal: 0xffa3c4,
    sun: 0xffb36b,
    sunX: 0.14,
    sunY: 9,
    sunAmount: 1,
    moonAmount: 0,
    starAmount: 0.25,
  },
  noon: {
    ground: 0x3f8f7a,
    groundShade: 0x26604f,
    crystal: 0x9ff5d8,
    sun: 0xfff2a8,
    sunX: 0.5,
    sunY: 1,
    sunAmount: 1,
    moonAmount: 0,
    starAmount: 0,
  },
  dusk: {
    ground: 0x9a4a2a,
    groundShade: 0x5e2a18,
    crystal: 0xffb86b,
    sun: 0xff7a3a,
    sunX: 0.86,
    sunY: 9,
    sunAmount: 1,
    moonAmount: 0.4,
    starAmount: 0.45,
  },
  night: { ...NIGHT, ground: 0x2c2c5e, groundShade: 0x1a1a3c, crystal: 0x6fd6ff },
};

export function skyFor(mode: Mode): SkyStyle {
  return mode.kind === "openspec" ? PHASES[mode.phase] : NIGHT;
}

export function blendSky(from: SkyStyle, to: SkyStyle, amount: number): SkyStyle {
  if (amount >= 1) return to;
  const mix = (start: Color, end: Color): Color => mixColors({ from: start, to: end, amount });
  const num = (start: number, end: number): number => lerp({ from: start, to: end, amount });
  return {
    ground: mix(from.ground, to.ground),
    groundShade: mix(from.groundShade, to.groundShade),
    crystal: mix(from.crystal, to.crystal),
    sun: mix(from.sun, to.sun),
    sunX: num(from.sunX, to.sunX),
    sunY: num(from.sunY, to.sunY),
    sunAmount: num(from.sunAmount, to.sunAmount),
    moonAmount: num(from.moonAmount, to.moonAmount),
    starAmount: num(from.starAmount, to.starAmount),
  };
}

const SUN_ROWS = [".###.", "#####", "#####", "#####", ".###."];
const BIG_MOON_ROWS = [".##.", "####", "####", ".##."];
const SMALL_MOON_ROWS = ["##", "##"];

function noise(index: number): number {
  const raw = Math.sin(index * 91.17 + 7.3) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawRows(
  bitmap: Bitmap,
  rows: readonly string[],
  x: number,
  y: number,
  color: Color,
): void {
  rows.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      if (cell === "#") setPixel({ bitmap, x: x + dx, y: y + dy, color });
    });
  });
}

function drawStars(bitmap: Bitmap, sky: SkyStyle, clockMs: number): void {
  const count = Math.round((bitmap.width / 4) * sky.starAmount);
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(noise(index) * bitmap.width);
    const y = Math.floor(noise(index + 500) * (FLOOR_TOP - 4));
    const twinkle = Math.sin(clockMs / 700 + index * 1.7) > 0.55;
    setPixel({ bitmap, x, y, color: twinkle ? 0xffffff : 0x8a8fb8 });
  }
}

function drawCelestial(bitmap: Bitmap, sky: SkyStyle): void {
  if (sky.sunAmount > 0.5) {
    const x = Math.round(sky.sunX * (bitmap.width - 5));
    drawRows(bitmap, SUN_ROWS, x, Math.round(sky.sunY), sky.sun);
  }
  if (sky.moonAmount > 0.5) {
    drawRows(bitmap, BIG_MOON_ROWS, bitmap.width - 18, 1, 0xd7defa);
    drawRows(bitmap, SMALL_MOON_ROWS, bitmap.width - 10, 4, 0xff9e8a);
  }
}

function drawGround(bitmap: Bitmap, sky: SkyStyle): void {
  for (let x = 0; x < bitmap.width; x += 1) {
    setPixel({ bitmap, x, y: FLOOR_TOP, color: sky.ground });
    for (let y = FLOOR_TOP + 1; y < STAGE_HEIGHT; y += 1) {
      setPixel({ bitmap, x, y, color: sky.groundShade });
    }
    if (noise(x + 900) > 0.86) {
      setPixel({ bitmap, x, y: FLOOR_TOP - 1, color: sky.crystal });
      setPixel({ bitmap, x, y: FLOOR_TOP, color: sky.crystal });
    }
  }
}

export function drawSky(options: { bitmap: Bitmap; sky: SkyStyle; clockMs: number }): void {
  drawStars(options.bitmap, options.sky, options.clockMs);
  drawCelestial(options.bitmap, options.sky);
  drawGround(options.bitmap, options.sky);
}
