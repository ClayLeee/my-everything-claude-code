import { DIGITS, TIMES } from "../art/digits";
import { setPixel } from "../shared/pixel/bitmap";
import type { Bitmap, Color } from "../shared/pixel/bitmap";
import { toRadians, WHITE } from "../shared/pixel/colors";
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
  splash: {
    durationMs: 380,
    reach: 4,
    colors: [0xffffff, 0xffe066, 0xffa64d, 0xb84dff],
    angles: [-60, -30, 0, 30, 60, 120, 240],
    hasFlash: true,
  },
  distant: {
    durationMs: 520,
    reach: 3,
    colors: [0xffffff, 0xfff3b0, 0xffa64d, 0x7a3db8],
    angles: [0, 90, 180, 270],
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
  debris: 600,
  smoke: 900,
  splash: 380,
  distant: 520,
  portal: 900,
  combo: 900,
  firework: 1300,
  dust: 420,
};

const FIREWORK_RISE_MS = 350;
// How far a firework's sparks fly from where it bursts, in pixels.
export const FIREWORK_REACH = 5;
// The pair bursts in two colors; `direction` picks the shell.
const FIREWORK_SHELLS: readonly (readonly Color[])[] = [
  [0xffffff, 0xffb3ec, 0xff6ad5, 0x9b2d7a],
  [0xffffff, 0xb3ecff, 0x6fd6ff, 0x2d6a9b],
];

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

// Two puffs curling up off the hot barrel, thinning to the sky.
function drawSmoke(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.smoke;
  const color = progress < 0.4 ? 0xb8b0c8 : progress < 0.75 ? 0x7a7490 : 0x4a4660;
  for (let puff = 0; puff < 2; puff += 1) {
    const rise = progress * 6 - puff * 2;
    if (rise < 0) continue;
    setPixel({
      bitmap,
      x: effect.x + Math.sin(progress * 7 + puff * 2) * 1.2,
      y: effect.y - rise,
      color,
    });
  }
}

// "×N" pops up over the kill, drifts up a little and cools from white to gold.
function drawCombo(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.combo;
  const x = Math.round(effect.x);
  const y = Math.round(effect.y + 1 - progress * 2);
  const color = progress < 0.2 ? 0xffffff : progress < 0.7 ? 0xffd84a : 0xc0812a;
  drawGlyph(bitmap, TIMES, x, y, color);
  Array.from(String(effect.value ?? 0)).forEach((digit, index) =>
    drawGlyph(bitmap, DIGITS[digit] ?? [], x + 4 + index * 4, y, color),
  );
}

// A shell climbs from its launch point trailing sparks, then bursts: the sparks fly out fast,
// slow down, sag under gravity, flicker and fade.
function drawFirework(bitmap: Bitmap, effect: Effect): void {
  // A shell queued behind the first starts below zero.
  if (effect.ageMs < 0) return;
  const from = effect.from ?? { x: effect.x, y: effect.y };
  if (effect.ageMs < FIREWORK_RISE_MS) {
    const t = effect.ageMs / FIREWORK_RISE_MS;
    const head = 1 - (1 - t) * (1 - t);
    [0xfff3b0, 0xffa64d, 0x7a3db8].forEach((color, back) => {
      const along = Math.max(0, head - back * 0.12);
      setPixel({
        bitmap,
        x: from.x + (effect.x - from.x) * along,
        y: from.y + (effect.y - from.y) * along,
        color,
      });
    });
    return;
  }
  const shell = FIREWORK_SHELLS[(effect.direction ?? 1) > 0 ? 0 : 1] ?? [WHITE];
  const progress = (effect.ageMs - FIREWORK_RISE_MS) / (EFFECT_LIFE_MS.firework - FIREWORK_RISE_MS);
  const spread = 1 - (1 - progress) ** 3;
  const sag = progress * progress * 3;
  const color = shell[Math.min(shell.length - 1, Math.floor(progress * shell.length))] ?? WHITE;
  const tick = Math.floor(effect.ageMs / 60);
  for (let spark = 0; spark < 10; spark += 1) {
    if (progress > 0.6 && (spark + tick) % 3 === 0) continue;
    const radians = toRadians(spark * 36 + 18);
    const radius = 1 + spread * FIREWORK_REACH;
    const x = effect.x + Math.cos(radians) * radius;
    const y = effect.y + Math.sin(radians) * radius * 0.7 + sag;
    setPixel({ bitmap, x, y, color });
    if (progress < 0.4) {
      setPixel({
        bitmap,
        x: effect.x + Math.cos(radians) * radius * 0.55,
        y: effect.y + Math.sin(radians) * radius * 0.4 + sag,
        color: shell[1] ?? color,
      });
    }
  }
  if (progress < 0.1) setPixel({ bitmap, x: effect.x, y: effect.y, color: WHITE });
}

// Two puffs kicked out along the ground on a landing.
function drawDust(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.dust;
  const color = progress < 0.4 ? 0xb8b0c8 : progress < 0.75 ? 0x7a7490 : 0x4a4660;
  [-1, 1].forEach((side) => {
    const x = effect.x + side * (1 + progress * 4);
    setPixel({ bitmap, x, y: effect.y, color });
    if (progress < 0.5) setPixel({ bitmap, x: x + side, y: effect.y - 1, color });
  });
}

// A tall oval that opens, swirls while the creature steps through, and closes.
function drawPortal(bitmap: Bitmap, effect: Effect): void {
  const progress = effect.ageMs / EFFECT_LIFE_MS.portal;
  const openness = Math.min(1, progress * 4, (1 - progress) * 3);
  const radiusY = 1 + openness * 5;
  const radiusX = 0.5 + openness * 1.5;
  const spin = progress * 720;
  for (let angle = 0; angle < 360; angle += 20) {
    const radians = toRadians(angle);
    const isBright = Math.abs(((angle - spin) % 360) + 360) % 360 < 60;
    setPixel({
      bitmap,
      x: effect.x + Math.cos(radians) * radiusX,
      y: effect.y + Math.sin(radians) * radiusY,
      color: isBright ? 0xf2c4ff : 0x9b4dff,
    });
  }
  if (openness > 0.6) setPixel({ bitmap, x: effect.x, y: effect.y, color: 0x2a0a40 });
}

export function drawEffect(options: { bitmap: Bitmap; effect: Effect }): void {
  const { bitmap, effect } = options;
  if (effect.kind === "portal") return drawPortal(bitmap, effect);
  if (effect.kind === "combo") return drawCombo(bitmap, effect);
  if (effect.kind === "smoke") return drawSmoke(bitmap, effect);
  if (effect.kind === "zee") return drawZee(bitmap, effect);
  if (effect.kind === "sweat") return drawSweat(bitmap, effect);
  if (effect.kind === "debris") return drawDebris(bitmap, effect);
  if (effect.kind === "firework") return drawFirework(bitmap, effect);
  if (effect.kind === "dust") return drawDust(bitmap, effect);
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
