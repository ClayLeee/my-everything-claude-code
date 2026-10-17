import { setPixel } from "../shared/pixel/bitmap";
import type { Bitmap, Color } from "../shared/pixel/bitmap";
import { toRadians } from "../shared/pixel/colors";
import type { Effect, EffectKind } from "../sim/types";

type Burst = {
  durationMs: number;
  reach: number;
  colors: readonly Color[];
  angles: readonly number[];
  hasFlash: boolean;
};

const ALL = [0, 45, 90, 135, 180, 225, 270, 315];
const RING = Array.from({ length: 24 }, (_, step) => step * 15);

const BURSTS: Partial<Record<EffectKind, Burst>> = {
  hit: {
    durationMs: 280,
    reach: 7,
    colors: [0xffffff, 0xff8be6, 0xb84dff],
    angles: ALL,
    hasFlash: true,
  },
  muzzle: {
    durationMs: 140,
    reach: 3,
    colors: [0xffffff, 0xff8be6],
    angles: [-45, 0, 45],
    hasFlash: true,
  },
  blast: {
    durationMs: 1200,
    reach: 18,
    colors: [0xffffff, 0xfff3b0, 0xffa64d, 0xff4d6d, 0x7a3db8],
    angles: RING,
    hasFlash: true,
  },
  sparkle: {
    durationMs: 600,
    reach: 3,
    colors: [0xffffff, 0xfff3b0, 0xf2c14e],
    angles: [0, 90, 180, 270],
    hasFlash: true,
  },
};

export const EFFECT_LIFE_MS: Record<EffectKind, number> = {
  hit: 280,
  muzzle: 140,
  blast: 1200,
  sparkle: 600,
  sweat: 650,
  zee: 2400,
  bubble: 2200,
  debris: 600,
};

const Z_SMALL = ["##", ".#", "##"];
const Z_BIG = ["###", "..#", ".#.", "#..", "###"];

function drawGlyph(
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

function drawZee(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.zee;
  const x = Math.round(effect.x + progress * 6 + Math.sin(progress * 6) * 1.2);
  const y = Math.round(effect.y - progress * 9);
  const color = progress < 0.5 ? 0xe6ecff : progress < 0.8 ? 0xa9b3d9 : 0x5a5f8a;
  drawGlyph(bitmap, progress < 0.35 ? Z_SMALL : Z_BIG, x, y, color);
}

function drawBubble(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.bubble;
  if (progress > 0.92) {
    [-2, 2].forEach((dx) =>
      setPixel({ bitmap, x: effect.x + dx, y: effect.y - 1, color: 0xbfe9ff }),
    );
    return;
  }
  const radius = 0.5 + Math.sin(progress * Math.PI * 3) * 0.3 + progress * 1.2;
  for (let angle = 0; angle < 360; angle += 30) {
    const radians = toRadians(angle);
    setPixel({
      bitmap,
      x: effect.x + radius + Math.cos(radians) * radius,
      y: effect.y + Math.sin(radians) * radius,
      color: 0x9fdcff,
    });
  }
  setPixel({ bitmap, x: effect.x + radius * 0.6, y: effect.y - radius * 0.5, color: 0xffffff });
}

function drawSweat(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.sweat;
  const direction = effect.direction ?? 1;
  const x = effect.x + direction * progress * 5;
  const y = effect.y - progress * 3 + progress * progress * 7;
  setPixel({ bitmap, x, y, color: 0x7fd4ff });
  setPixel({ bitmap, x, y: y - 1, color: 0xd6f3ff });
}

function drawDebris(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.debris;
  const direction = effect.direction ?? 1;
  for (let piece = 0; piece < 3; piece += 1) {
    const spread = (piece - 1) * 0.8;
    const x = effect.x + direction * progress * (4 + piece * 2);
    const y = effect.y + spread - progress * 4 + progress * progress * 9;
    setPixel({ bitmap, x, y, color: piece === 0 ? 0xffffff : 0xff8be6 });
  }
}

export function drawEffect(options: { bitmap: Bitmap; effect: Effect }): void {
  const { bitmap, effect } = options;
  if (effect.kind === "zee") return drawZee(bitmap, effect);
  if (effect.kind === "bubble") return drawBubble(bitmap, effect);
  if (effect.kind === "sweat") return drawSweat(bitmap, effect);
  if (effect.kind === "debris") return drawDebris(bitmap, effect);
  const burst = BURSTS[effect.kind];
  if (!burst) return;
  const progress = effect.ageMs / burst.durationMs;
  const color =
    burst.colors[Math.min(burst.colors.length - 1, Math.floor(progress * burst.colors.length))];
  if (color === undefined) return;
  const radius = 1 + progress * burst.reach;
  burst.angles.forEach((angle) => {
    const radians = toRadians(angle);
    setPixel({
      bitmap,
      x: effect.x + Math.cos(radians) * radius,
      y: effect.y + Math.sin(radians) * radius * 0.6,
      color,
    });
  });
  const first = burst.colors[0];
  if (burst.hasFlash && progress < 0.3 && first !== undefined) {
    [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) =>
      setPixel({ bitmap, x: effect.x + (dx ?? 0), y: effect.y + (dy ?? 0), color: first }),
    );
  }
}
