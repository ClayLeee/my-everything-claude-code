import { ALIEN } from "../art/alien";
import { BOSS_FRAMES, BOSS_WIDTH } from "../art/boss";
import { DEATH_GLOW, MONSTER_FRAMES } from "../art/monsters";
import { setPixel, stamp } from "../shared/pixel/bitmap";
import type { Bitmap, Color, Tint } from "../shared/pixel/bitmap";
import { mixColors, WHITE } from "../shared/pixel/colors";
import { phaseRank } from "../openspec";
import {
  BEAM_MS,
  BOSS_DEATH_MS,
  BOSS_HITS,
  DEATH_MS,
  FLOOR_TOP,
  HOME_X,
  MUZZLE_OFFSET_X,
  MUZZLE_OFFSET_Y,
  WAKE_MS,
  WALK_FRAME_MS,
} from "../sim/constants";
import type { Alien, Boss, Effect, Mode, Monster } from "../sim/types";
import { drawEffect } from "./effects";
import { drawSky } from "./sky";
import type { SkyStyle } from "./sky";

const whiten: Tint = (color) => mixColors({ from: color, to: WHITE, amount: 0.85 });

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

function drawOutpost(bitmap: Bitmap, mode: Mode, clockMs: number): void {
  if (mode.kind !== "openspec") return;
  const x = bitmap.width - 13;
  const hull: Color = 0x9aa6c4;
  const shade: Color = 0x5d6684;
  const dome = ["...###...", "..#####..", ".#######.", "#########"];
  dome.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      if (cell === "#")
        setPixel({ bitmap, x: x + dx, y: FLOOR_TOP - 4 + dy, color: dy === 3 ? shade : hull });
    });
  });
  setPixel({ bitmap, x: x + 4, y: FLOOR_TOP - 5, color: shade });
  setPixel({ bitmap, x: x + 4, y: FLOOR_TOP - 6, color: shade });
  const beaconOn = Math.floor(clockMs / 500) % 2 === 0;
  setPixel({ bitmap, x: x + 4, y: FLOOR_TOP - 7, color: beaconOn ? 0xff4d6d : 0x5a1a2a });
  const current = phaseRank(mode.phase);
  for (let lamp = 0; lamp < 4; lamp += 1) {
    const isLit = lamp < current || (lamp === current && Math.floor(clockMs / 350) % 2 === 0);
    const color = lamp < current ? 0x7cfc9a : isLit ? 0xffe066 : 0x2b3044;
    setPixel({ bitmap, x: x + 2 + lamp + (lamp > 1 ? 1 : 0), y: FLOOR_TOP - 2, color });
  }
}

function drawMonster(bitmap: Bitmap, monster: Monster): void {
  const frames = MONSTER_FRAMES[monster.kind];
  const sprite = frames[Math.floor(monster.walkMs / WALK_FRAME_MS) % frames.length] ?? frames[0];
  const hover = monster.kind === "moth" ? 3 + Math.round(Math.sin(monster.walkMs / 240) * 1.5) : 0;
  const x = Math.round(monster.x);
  const y = FLOOR_TOP - sprite.height - hover;
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
  stamp({ target: bitmap, source: sprite, x, y, tint: monster.flashMs > 0 ? whiten : undefined });
}

function drawBoss(bitmap: Bitmap, boss: Boss): void {
  const sprite = BOSS_FRAMES[Math.floor(boss.walkMs / 420) % BOSS_FRAMES.length] ?? BOSS_FRAMES[0];
  const x = Math.round(boss.x);
  const y = FLOOR_TOP - sprite.height;
  if (boss.phase === "dying") {
    drawShatter({
      target: bitmap,
      source: sprite,
      x,
      y,
      progress: Math.min(1, boss.phaseMs / BOSS_DEATH_MS),
      seed: 99,
      glow: 0xffa64d,
      spread: 26,
    });
    return;
  }
  const sway = boss.phase === "fight" ? Math.round(Math.sin(boss.walkMs / 300)) : 0;
  stamp({
    target: bitmap,
    source: sprite,
    x: x + sway,
    y,
    tint: boss.flashMs > 0 ? whiten : undefined,
  });
  const filled = Math.round((boss.hitsRemaining / BOSS_HITS) * BOSS_WIDTH);
  for (let dx = 0; dx < BOSS_WIDTH; dx += 1) {
    setPixel({ bitmap, x: x + dx, y: 0, color: dx < filled ? 0xff3b5c : 0x3a1a2a });
  }
}

function drawAlien(bitmap: Bitmap, alien: Alien): void {
  const t = alien.clockMs;
  if (alien.mode === "idle") {
    if (alien.activity === "sleep") {
      const sprite = Math.floor(t / 900) % 2 === 0 ? ALIEN.sleep : ALIEN.sleepBreath;
      stamp({ target: bitmap, source: sprite, x: HOME_X, y: FLOOR_TOP - sprite.height });
      return;
    }
    if (alien.activity === "workout") {
      const sprite = Math.floor(t / 480) % 2 === 0 ? ALIEN.pushupUp : ALIEN.pushupDown;
      stamp({ target: bitmap, source: sprite, x: HOME_X, y: FLOOR_TOP - sprite.height });
      return;
    }
    const sprite = Math.floor(t / 600) % 2 === 0 ? ALIEN.flex : ALIEN.flexPump;
    stamp({ target: bitmap, source: sprite, x: HOME_X, y: FLOOR_TOP - sprite.height });
    return;
  }
  if (alien.mode === "cheer") {
    const sprite = Math.floor(alien.modeMs / 220) % 2 === 0 ? ALIEN.flex : ALIEN.flexPump;
    const hop = Math.round(2 * Math.abs(Math.sin(alien.modeMs / 120)));
    stamp({ target: bitmap, source: sprite, x: HOME_X, y: FLOOR_TOP - sprite.height - hop });
    return;
  }
  const isBlinking = (alien.mode === "ready" || alien.mode === "cooldown") && t % 3200 < 160;
  const rising = alien.mode === "wake" ? Math.round((1 - alien.modeMs / WAKE_MS) * 3) : 0;
  const recoil = alien.mode === "fire" && alien.modeMs < BEAM_MS * 0.5 ? -1 : 0;
  const sprite = isBlinking ? ALIEN.blink : ALIEN.stand;
  stamp({
    target: bitmap,
    source: sprite,
    x: HOME_X + recoil,
    y: FLOOR_TOP - sprite.height + rising,
  });
}

function drawBeam(bitmap: Bitmap, alien: Alien): void {
  if (alien.mode !== "fire") return;
  const progress = alien.modeMs / BEAM_MS;
  const startX = HOME_X + MUZZLE_OFFSET_X - 1;
  const y = 1 + MUZZLE_OFFSET_Y;
  const reach = Math.min(1, progress * 2);
  const endX = startX + (alien.targetX - startX) * reach;
  const fading = progress > 0.7;
  for (let x = startX; x <= endX; x += 1) {
    const nearHead = endX - x < 3;
    setPixel({ bitmap, x, y, color: nearHead ? WHITE : fading ? 0x9b4dff : 0xff8be6 });
    if (!fading && (x + Math.floor(alien.modeMs / 40)) % 3 === 0)
      setPixel({ bitmap, x, y: y - 1, color: 0xb84dff });
  }
}

export function drawScene(options: {
  bitmap: Bitmap;
  sky: SkyStyle;
  mode: Mode;
  alien: Alien;
  monsters: readonly Monster[];
  boss: Boss | undefined;
  effects: readonly Effect[];
  slain: number;
}): void {
  const { bitmap, alien } = options;
  drawSky({ bitmap, sky: options.sky, clockMs: alien.clockMs });
  drawOutpost(bitmap, options.mode, alien.clockMs);
  if (options.boss) drawBoss(bitmap, options.boss);
  options.monsters.forEach((monster) => drawMonster(bitmap, monster));
  drawAlien(bitmap, alien);
  drawBeam(bitmap, alien);
  options.effects.forEach((effect) => drawEffect({ bitmap, effect }));
}
