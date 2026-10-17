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
    reach: 16,
    colors: [0xffffff, 0xfff3b0, 0xffa64d, 0xff4d6d, 0x7a3db8],
    angles: RING,
    hasFlash: true,
  },
  sparkle: {
    durationMs: 500,
    reach: 3,
    colors: [0xffffff, 0xfff3b0],
    angles: [0, 90, 180, 270],
    hasFlash: true,
  },
};

const Z_ROWS = ["###", "..#", ".#.", "#..", "###"];

export const EFFECT_LIFE_MS: Record<EffectKind, number> = {
  hit: 280,
  muzzle: 140,
  blast: 1200,
  sparkle: 500,
  sweat: 700,
  zee: 2200,
};

function drawZee(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.zee;
  const x = Math.round(effect.x + progress * 4);
  const y = Math.round(effect.y - progress * 8);
  const color = progress < 0.6 ? 0xdfe7ff : 0x8a8fb8;
  Z_ROWS.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      if (cell === "#") setPixel({ bitmap, x: x + dx, y: y + dy, color });
    });
  });
}

function drawSweat(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.sweat;
  setPixel({ bitmap, x: effect.x, y: effect.y + progress * 6, color: 0x7fd4ff });
}

export function drawEffect(options: { bitmap: Bitmap; effect: Effect }): void {
  const { bitmap, effect } = options;
  if (effect.kind === "zee") return drawZee(bitmap, effect);
  if (effect.kind === "sweat") return drawSweat(bitmap, effect);
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
