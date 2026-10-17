import { ALIEN, FLEX_SHIFT_X, MUZZLE_X, MUZZLE_Y } from "../art/alien";
import { BOSS_CORE, BOSS_FRAMES, BOSS_WIDTH } from "../art/boss";
import { DEATH_GLOW, MONSTER_FRAMES } from "../art/monsters";
import { setPixel, stamp } from "../shared/pixel/bitmap";
import type { Bitmap, Color, Tint } from "../shared/pixel/bitmap";
import { mixColors, WHITE } from "../shared/pixel/colors";
import { phaseRank } from "../openspec";
import {
  ALIEN_HEIGHT,
  BEAM_MS,
  BOSS_DEATH_MS,
  BOSS_HITS,
  DEATH_MS,
  FLEX_SIDE_MS,
  FLEX_RELAX_MS,
  HOME_X,
  LIFT_CYCLE_MS,
  WAKE_MS,
  WALK_FRAME_MS,
} from "../sim/constants";
import type { Alien, Boss, Effect, Mode, Monster } from "../sim/types";
import { drawEffect } from "./effects";
import { drawSky } from "./sky";
import type { SkyStyle } from "./sky";

const whiten: Tint = (color) => mixColors({ from: color, to: WHITE, amount: 0.85 });

export function muzzleOf(floor: number): { x: number; y: number } {
  return { x: HOME_X + MUZZLE_X, y: floor - ALIEN_HEIGHT + MUZZLE_Y };
}

function noise(x: number, y: number, seed: number): number {
  const raw = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawShatter(options: {
  target: Bitmap;
  source: Bitmap;
  x: number;
  y: number;
  progress: number;
  seed: number;
  glow: Color;
  spread: number;
}): void {
  const { source, progress } = options;
  source.pixels.forEach((color, index) => {
    if (color === null) return;
    const column = index % source.width;
    const row = Math.floor(index / source.width);
    const n = noise(column, row, options.seed);
    if (progress > 0.45 + n * 0.55) return;
    setPixel({
      bitmap: options.target,
      x: options.x + column + (n - 0.5) * progress * options.spread,
      y: options.y + row + progress * progress * (4 + n * 10) - progress * 4,
      color:
        progress < 0.12
          ? WHITE
          : mixColors({ from: color, to: options.glow, amount: progress * 1.8 }),
    });
  });
}

function drawOutpost(bitmap: Bitmap, mode: Mode, clockMs: number, floor: number): void {
  if (mode.kind !== "openspec") return;
  const x = bitmap.width - 13;
  const dome = ["....ooo....", "..oohhhoo..", ".ohhhhhhho.", "ohhwhhhwhho", "ossssssssso"];
  const colors: Record<string, Color> = { o: 0x2b3044, h: 0x9aa6c4, s: 0x5d6684, w: 0x9fe8ff };
  dome.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      const color = colors[cell];
      if (color !== undefined) setPixel({ bitmap, x: x + dx, y: floor - 5 + dy, color });
    });
  });
  setPixel({ bitmap, x: x + 5, y: floor - 6, color: 0x5d6684 });
  setPixel({ bitmap, x: x + 5, y: floor - 7, color: 0x5d6684 });
  setPixel({
    bitmap,
    x: x + 5,
    y: floor - 8,
    color: Math.floor(clockMs / 500) % 2 === 0 ? 0xff4d6d : 0x5a1a2a,
  });
  const current = phaseRank(mode.phase);
  for (let lamp = 0; lamp < 4; lamp += 1) {
    const isBlinkOn = Math.floor(clockMs / 350) % 2 === 0;
    const color =
      lamp < current ? 0x7cfc9a : lamp === current ? (isBlinkOn ? 0xffe066 : 0x6b5a1a) : 0x1a1e2c;
    setPixel({ bitmap, x: x + 2 + lamp * 2, y: floor - 1, color });
  }
}

function drawMonster(bitmap: Bitmap, monster: Monster, floor: number): void {
  const frames = MONSTER_FRAMES[monster.kind];
  const sprite = frames[Math.floor(monster.walkMs / WALK_FRAME_MS) % frames.length] ?? frames[0];
  const hover = monster.kind === "moth" ? 3 + Math.round(Math.sin(monster.walkMs / 240) * 1.5) : 0;
  const bob =
    monster.kind !== "moth" && Math.floor(monster.walkMs / (WALK_FRAME_MS / 2)) % 4 === 1 ? -1 : 0;
  const x = Math.round(monster.x);
  const y = floor - sprite.height - hover + bob;
  if (monster.phase === "dying") {
    drawShatter({
      target: bitmap,
      source: sprite,
      x,
      y,
      progress: Math.min(1, monster.phaseMs / DEATH_MS),
      seed: monster.id,
      glow: DEATH_GLOW[monster.kind],
      spread: 14,
    });
    return;
  }
  if (monster.kind !== "moth") {
    for (let dx = 2; dx < sprite.width - 2; dx += 1)
      setPixel({ bitmap, x: x + dx, y: floor, color: 0x120c1e });
  }
  stamp({ target: bitmap, source: sprite, x, y, tint: monster.flashMs > 0 ? whiten : undefined });
}

function drawBoss(bitmap: Bitmap, boss: Boss, floor: number): void {
  const sprite = BOSS_FRAMES[Math.floor(boss.walkMs / 420) % BOSS_FRAMES.length] ?? BOSS_FRAMES[0];
  const x = Math.round(boss.x);
  const y = floor - sprite.height;
  if (boss.phase === "dying") {
    drawShatter({
      target: bitmap,
      source: sprite,
      x,
      y,
      progress: Math.min(1, boss.phaseMs / BOSS_DEATH_MS),
      seed: 99,
      glow: 0xffa64d,
      spread: 28,
    });
    return;
  }
  const pulse = (Math.sin(boss.walkMs / 180) + 1) / 2;
  const tint: Tint = (color) => {
    if (boss.flashMs > 0) return whiten(color);
    return color === BOSS_CORE
      ? mixColors({ from: BOSS_CORE, to: WHITE, amount: pulse * 0.8 })
      : color;
  };
  const sway = boss.phase === "fight" ? Math.round(Math.sin(boss.walkMs / 300)) : 0;
  for (let dx = 2; dx < sprite.width - 2; dx += 1)
    setPixel({ bitmap, x: x + dx, y: floor, color: 0x120c1e });
  stamp({ target: bitmap, source: sprite, x: x + sway, y, tint });
  const barY = Math.max(0, y - 2);
  const filled = Math.round((boss.hitsRemaining / BOSS_HITS) * BOSS_WIDTH);
  for (let dx = 0; dx < BOSS_WIDTH; dx += 1) {
    const color = dx < filled ? (dx < filled - 1 ? 0xff3b5c : 0xff8fa3) : 0x3a1a2a;
    setPixel({ bitmap, x: x + dx, y: barY, color });
  }
}

function drawFlex(bitmap: Bitmap, ms: number, x: number, y: number): void {
  const isPumped = ms % FLEX_SIDE_MS >= FLEX_RELAX_MS;
  const side = Math.floor(ms / FLEX_SIDE_MS) % 2 === 0 ? "right" : "left";
  const sprite =
    side === "right"
      ? isPumped
        ? ALIEN.flexRightPump
        : ALIEN.flexRight
      : isPumped
        ? ALIEN.flexLeftPump
        : ALIEN.flexLeft;
  stamp({ target: bitmap, source: sprite, x: x + FLEX_SHIFT_X[side], y: y - sprite.height });
}

function idleSprite(alien: Alien): { sprite: Bitmap; isLow: boolean } | undefined {
  const t = alien.clockMs;
  if (alien.activity === "sleep")
    return {
      sprite: Math.floor(t / 1100) % 2 === 0 ? ALIEN.sleep : ALIEN.sleepBreath,
      isLow: true,
    };
  if (alien.activity === "workout")
    return {
      sprite: alien.activityMs % LIFT_CYCLE_MS < LIFT_CYCLE_MS / 2 ? ALIEN.liftDown : ALIEN.liftUp,
      isLow: false,
    };
  return undefined;
}

function drawAlien(bitmap: Bitmap, alien: Alien, floor: number): void {
  for (let dx = 1; dx < 12; dx += 1)
    setPixel({ bitmap, x: HOME_X + dx, y: floor, color: 0x120c1e });
  if (alien.mode === "idle") {
    const idle = idleSprite(alien);
    if (idle === undefined) drawFlex(bitmap, alien.activityMs, HOME_X, floor);
    else stamp({ target: bitmap, source: idle.sprite, x: HOME_X, y: floor - idle.sprite.height });
    return;
  }
  if (alien.mode === "cheer") {
    const hop = Math.round(2 * Math.abs(Math.sin(alien.modeMs / 120)));
    drawFlex(bitmap, alien.modeMs + FLEX_RELAX_MS, HOME_X, floor - hop);
    return;
  }
  const t = alien.clockMs;
  const isBlinking = (alien.mode === "ready" || alien.mode === "cooldown") && t % 3200 < 160;
  const rising = alien.mode === "wake" ? Math.round((1 - alien.modeMs / WAKE_MS) * 3) : 0;
  const recoil = alien.mode === "fire" && alien.modeMs < BEAM_MS * 0.5 ? -1 : 0;
  const sprite = isBlinking
    ? ALIEN.blink
    : Math.floor(t / 900) % 2 === 0
      ? ALIEN.stand
      : ALIEN.sway;
  stamp({ target: bitmap, source: sprite, x: HOME_X + recoil, y: floor - sprite.height + rising });
}

function drawBeam(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (alien.mode !== "fire") return;
  const progress = alien.modeMs / BEAM_MS;
  const muzzle = muzzleOf(floor);
  const startX = muzzle.x;
  const reach = Math.min(1, progress * 2.2);
  const endX = startX + (alien.targetX - startX) * reach;
  const fading = progress > 0.75;
  const core: Color = fading ? 0xd9a6ff : 0xffffff;
  const edge: Color = fading ? 0x7a3db8 : 0xff6ad5;
  for (let x = startX; x <= endX; x += 1) {
    const flicker = (x + Math.floor(alien.modeMs / 30)) % 4;
    setPixel({ bitmap, x, y: muzzle.y, color: core });
    if (!fading || flicker === 0) {
      setPixel({ bitmap, x, y: muzzle.y - 1, color: flicker === 0 ? 0xffb3ec : edge });
      setPixel({ bitmap, x, y: muzzle.y + 1, color: flicker === 2 ? 0xffb3ec : edge });
    }
  }
  if (!fading) {
    [
      [0, -2],
      [1, -1],
      [1, 1],
      [0, 2],
      [2, 0],
    ].forEach(([dx, dy]) =>
      setPixel({ bitmap, x: endX + (dx ?? 0), y: muzzle.y + (dy ?? 0), color: 0xffd6f5 }),
    );
  }
}

export function drawScene(options: {
  bitmap: Bitmap;
  floor: number;
  sky: SkyStyle;
  mode: Mode;
  alien: Alien;
  monsters: readonly Monster[];
  boss: Boss | undefined;
  effects: readonly Effect[];
}): void {
  const { bitmap, alien, floor } = options;
  drawSky({ bitmap, sky: options.sky, clockMs: alien.clockMs, floor });
  drawOutpost(bitmap, options.mode, alien.clockMs, floor);
  if (options.boss) drawBoss(bitmap, options.boss, floor);
  options.monsters.forEach((monster) => drawMonster(bitmap, monster, floor));
  drawAlien(bitmap, alien, floor);
  drawBeam(bitmap, alien, floor);
  options.effects.forEach((effect) => drawEffect({ bitmap, effect }));
}
