import {
  ALIEN,
  FLEX_FRONT_SHIFT_X,
  FLEX_SHIFT_X,
  GUN_CELLS,
  GUN_TIP,
  HIGH_FIVE_HAND,
  MUZZLE_X,
  MUZZLE_Y,
} from "../art/alien";
import {
  CONFETTI,
  FRIEND_PALETTE,
  FURBALL_ROWS,
  PARTY_UFO_ROWS,
  PARTY_UFO_WIDTH,
  ROBOT,
  ROBOT_LAMP,
} from "../art/friends";
import { BOSS_CORE, BOSS_FRAMES, BOSS_WIDTH } from "../art/boss";
import { DIGITS, QUESTION, SKULL, STAR, TIMES } from "../art/digits";
import { COMET_TAIL, FLYER_COLORS, SATELLITE_ROWS, UFO_LIGHTS, UFO_ROWS } from "../art/flyers";
import { DEATH_GLOW, MONSTER_FRAMES } from "../art/monsters";
import { setPixel, stamp } from "../shared/pixel/bitmap";
import type { Bitmap, Color, Tint } from "../shared/pixel/bitmap";
import { mixColors, toRadians, WHITE } from "../shared/pixel/colors";
import { phaseRank } from "../openspec";
import {
  ALIEN_HEIGHT,
  BAG_MS,
  BEAM_MS,
  BOSS_DEATH_MS,
  DEATH_MS,
  FLEX_SIDE_MS,
  FLEX_RELAX_MS,
  HEAT_MS,
  HOME_X,
  LONG_CALL_MS,
  STATS_ENTRY_MS,
  STATS_MS,
  STATS_TOTAL_MS,
  WAKE_MS,
  WALK_FRAME_MS,
} from "../sim/constants";
import type {
  Alien,
  Boss,
  Effect,
  Flyer,
  Mode,
  Monster,
  MonsterKind,
  Orb,
  Tally,
} from "../sim/types";
import { flexPose, liftPose, partyPose, sleepPose } from "../sim/routines";
import type { LiftPhase, SleepPose } from "../sim/routines";
import { drawEffect } from "./effects";
import { drawSky } from "./sky";
import type { SkyStyle } from "./sky";

const whiten: Tint = (color) => mixColors({ from: color, to: WHITE, amount: 0.85 });
const redden =
  (amount: number): Tint =>
  (color) =>
    mixColors({ from: color, to: 0xff3b3b, amount });

// White on a hit, a red blink when its call failed, a slow red pulse while a call runs long.
function monsterTint(monster: Monster): Tint | undefined {
  if (monster.flashMs > 0) return whiten;
  if (monster.rageMs > 0)
    return Math.floor(monster.rageMs / 100) % 2 === 0 ? redden(0.75) : undefined;
  if (!monster.isDoomed && monster.waitMs >= LONG_CALL_MS)
    return redden(((Math.sin(monster.walkMs / 250) + 1) / 2) * 0.45);
  return undefined;
}

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
  stamp({ target: bitmap, source: sprite, x, y, tint: monsterTint(monster) });
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
  const filled = Math.round((boss.hitsRemaining / boss.maxHits) * BOSS_WIDTH);
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

const LIFT_FRAMES: Record<LiftPhase, Bitmap> = {
  rack: ALIEN.liftDown,
  press: ALIEN.liftPress,
  strain: ALIEN.liftStrain,
  bounce: ALIEN.liftBounce,
  lockout: ALIEN.liftUp,
  lower: ALIEN.liftPress,
  rest: ALIEN.liftRest,
};

const BUBBLE_COLOR: Color = 0x9fdcff;

// The snot bubble swells on the out-breath and pops into a spray now and then.
function drawSnot(bitmap: Bitmap, pose: SleepPose, x: number, y: number): void {
  if (pose.popMs !== undefined) {
    const spread = 1 + Math.round(pose.popMs / 90);
    [-1, 1].forEach((side) => {
      setPixel({ bitmap, x: x + 1 + side * spread, y: y - 1, color: 0xbfe9ff });
      setPixel({ bitmap, x: x + 1 + side * (spread - 1), y: y + 1, color: BUBBLE_COLOR });
    });
    return;
  }
  if (pose.bubble === undefined) return;
  const radius = 0.3 + pose.bubble * 1.9;
  for (let angle = 0; angle < 360; angle += 30) {
    const radians = toRadians(angle);
    setPixel({
      bitmap,
      x: x + radius + Math.cos(radians) * radius,
      y: y + Math.sin(radians) * radius,
      color: BUBBLE_COLOR,
    });
  }
  if (radius > 1) setPixel({ bitmap, x: x + radius * 0.6, y: y - radius * 0.5, color: WHITE });
}

function drawIdle(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (alien.activity === "sleep") {
    const pose = sleepPose(alien.activityMs);
    const isFull = pose.fill > 0.5;
    const sprite = pose.isFacingAway
      ? isFull
        ? ALIEN.sleepAwayBreath
        : ALIEN.sleepAway
      : isFull
        ? ALIEN.sleepBreath
        : ALIEN.sleep;
    const y = floor - sprite.height - pose.tossY;
    stamp({ target: bitmap, source: sprite, x: HOME_X, y });
    drawSnot(bitmap, pose, HOME_X + 9, y + 2);
    return;
  }
  if (alien.activity === "workout") {
    const pose = liftPose(alien.activityMs);
    const sprite = pose.isPanting ? ALIEN.liftPant : LIFT_FRAMES[pose.phase];
    stamp({ target: bitmap, source: sprite, x: HOME_X + pose.shakeX, y: floor - sprite.height });
    return;
  }
  const pose = flexPose(alien.activityMs);
  if (pose.phase === "breathe" || pose.phase === "relax") {
    const sprite = ALIEN.standBare;
    stamp({ target: bitmap, source: sprite, x: HOME_X, y: floor - sprite.height + pose.dipY });
    return;
  }
  const isPumped = pose.phase === "hit";
  if (pose.shot === "front") {
    const sprite = isPumped ? ALIEN.flexFrontPump : ALIEN.flexFront;
    const x = HOME_X + FLEX_FRONT_SHIFT_X + pose.shakeX;
    stamp({ target: bitmap, source: sprite, x, y: floor - sprite.height });
    return;
  }
  const sprite =
    pose.shot === "right"
      ? isPumped
        ? ALIEN.flexRightPump
        : ALIEN.flexRight
      : isPumped
        ? ALIEN.flexLeftPump
        : ALIEN.flexLeft;
  const x = HOME_X + FLEX_SHIFT_X[pose.shot] + pose.shakeX;
  stamp({ target: bitmap, source: sprite, x, y: floor - sprite.height });
}

const CELL_EMPTY: Color = 0x3a1430;
const CELL_DIM: Color = 0x8a2a78;
const CELL_LIT: Color = 0xff6ad5;
const TIP_COLD: Color = 0x7a3d6e;

// The gun tells the shot: the cell idles in a slow pulse, burns white while aiming, drains
// back to front as the beam runs, then refills while the tip cools from orange to cold.
function drawGun(bitmap: Bitmap, alien: Alien, x: number, y: number): void {
  const pulse = (Math.sin(alien.clockMs / 260) + 1) / 2;
  const idleCell = mixColors({ from: CELL_DIM, to: CELL_LIT, amount: pulse });
  const heat = alien.heatMs / HEAT_MS;
  let lit = GUN_CELLS.length;
  let cell = idleCell;
  let tip = heat > 0 ? mixColors({ from: TIP_COLD, to: 0xffa64d, amount: heat }) : TIP_COLD;
  if (alien.mode === "aim") {
    cell = 0xffd6f5;
    tip = WHITE;
  } else if (alien.mode === "fire") {
    const progress = alien.modeMs / BEAM_MS;
    lit = GUN_CELLS.length - Math.floor(progress * GUN_CELLS.length);
    cell = CELL_LIT;
    tip = progress < 0.75 ? WHITE : 0xffb3ec;
  } else if (heat > 0) {
    lit = Math.round((1 - heat) * GUN_CELLS.length);
  }
  GUN_CELLS.forEach((spot, index) =>
    setPixel({ bitmap, x: x + spot.x, y: y + spot.y, color: index < lit ? cell : CELL_EMPTY }),
  );
  GUN_TIP.forEach((spot) => setPixel({ bitmap, x: x + spot.x, y: y + spot.y, color: tip }));
}

function drawAlien(bitmap: Bitmap, alien: Alien, floor: number): void {
  for (let dx = 1; dx < 12; dx += 1)
    setPixel({ bitmap, x: HOME_X + dx, y: floor, color: 0x120c1e });
  if (isPresenting(alien)) {
    const ms = STATS_MS - alien.statsMs;
    const pose = partyPose(ms);
    const sprite = pose.isHighFive
      ? ALIEN.highFive
      : Math.floor(ms / 200) % 2 === 0
        ? ALIEN.cheer
        : ALIEN.cheerWave;
    const hop = pose.isHighFive ? 0 : Math.round(1.5 * Math.abs(Math.sin(ms / 180)));
    stamp({ target: bitmap, source: sprite, x: HOME_X, y: floor - sprite.height - hop });
    return;
  }
  if (alien.mode === "idle") {
    drawIdle(bitmap, alien, floor);
    return;
  }
  if (alien.mode === "cheer") {
    const hop = Math.round(2 * Math.abs(Math.sin(alien.modeMs / 120)));
    drawFlex(bitmap, alien.modeMs + FLEX_RELAX_MS, HOME_X, floor - hop);
    return;
  }
  const t = alien.clockMs;
  const isBlinking = (alien.mode === "ready" || alien.mode === "cooldown") && t % 3200 < 160;
  // Waking hops out of the bag: starts low, springs up, lands.
  const wake = Math.min(1, alien.modeMs / WAKE_MS);
  const rising =
    alien.mode === "wake" ? Math.round(3 * (1 - wake) - 4 * Math.sin(wake * Math.PI)) : 0;
  const recoil = alien.mode === "fire" && alien.modeMs < BEAM_MS * 0.5 ? -1 : 0;
  const sprite = isBlinking
    ? ALIEN.blink
    : Math.floor(t / 900) % 2 === 0
      ? ALIEN.stand
      : ALIEN.sway;
  const x = HOME_X + recoil;
  const y = floor - sprite.height + rising;
  const isHurtBlink = alien.hurtMs > 0 && Math.floor(alien.hurtMs / 100) % 2 === 0;
  stamp({ target: bitmap, source: sprite, x, y, tint: isHurtBlink ? redden(0.35) : undefined });
  drawGun(bitmap, alien, x, y);
}

// The bag the alien slept in lies where it was and fades into the ground.
function drawBag(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (alien.bagMs <= 0) return;
  const fade = 1 - alien.bagMs / BAG_MS;
  const tint: Tint = (color) => mixColors({ from: color, to: 0x120c1e, amount: fade * fade });
  stamp({ target: bitmap, source: ALIEN.bag, x: HOME_X + 6, y: floor - ALIEN.bag.height, tint });
}

function paintRows(
  bitmap: Bitmap,
  rows: readonly string[],
  x: number,
  y: number,
  colorOf: (cell: string, column: number) => Color | undefined,
): void {
  rows.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      const color = colorOf(cell, dx);
      if (color !== undefined) setPixel({ bitmap, x: x + dx, y: y + dy, color });
    });
  });
}

// A UFO bobs with its lights chasing along the rim, a comet streaks with a fading tail,
// a satellite drifts with a blinking beacon.
function drawFlyer(bitmap: Bitmap, flyer: Flyer): void {
  const x = Math.round(flyer.x);
  const y = Math.round(flyer.y);
  if (flyer.kind === "comet") {
    COMET_TAIL.forEach((color, index) => {
      const back = index * -flyer.direction;
      setPixel({ bitmap, x: x + back, y: Math.round(flyer.y - index * 0.08), color });
    });
    setPixel({ bitmap, x, y: y - 1, color: 0xfff3b0 });
    return;
  }
  if (flyer.kind === "satellite") {
    const isBlinkOn = Math.floor(flyer.ageMs / 500) % 2 === 0;
    paintRows(bitmap, SATELLITE_ROWS, x, y, (cell) =>
      cell === "r" && !isBlinkOn ? 0x5a1a2a : FLYER_COLORS[cell],
    );
    return;
  }
  const bob = Math.round(Math.sin(flyer.ageMs / 400));
  const lit = Math.floor(flyer.ageMs / 160);
  paintRows(bitmap, UFO_ROWS, x, y + bob, (cell, column) =>
    cell === "L" ? UFO_LIGHTS[(column + lit) % UFO_LIGHTS.length] : FLYER_COLORS[cell],
  );
}

// The stats party plays while the alien is free to present the board.
export function isPresenting(alien: Alien): boolean {
  return (
    alien.statsMs > 0 &&
    (alien.mode === "idle" || alien.mode === "ready" || alien.mode === "cheer")
  );
}

// The robot lands just past the alien's raised hand and the UFO hovers over the robot, as low
// as the sky over the alien's head allows; in the short pane that is above the top edge, so
// only the beam and the robot dropping out of it show.
export function partyLayout(floor: number): {
  robotX: number;
  ufoX: number;
  hoverY: number;
  slap: { x: number; y: number };
} {
  const alienTop = floor - ALIEN_HEIGHT;
  const robotX = HOME_X + HIGH_FIVE_HAND.x + 1;
  return {
    robotX,
    ufoX: robotX + Math.floor(ROBOT.idle.width / 2) - Math.floor(PARTY_UFO_WIDTH / 2),
    hoverY: alienTop - PARTY_UFO_ROWS.length - 1,
    slap: { x: HOME_X + HIGH_FIVE_HAND.x, y: alienTop + HIGH_FIVE_HAND.y },
  };
}

// A shimmering cone of light from the belly hatch to the ground.
function drawTractorBeam(bitmap: Bitmap, centerX: number, top: number, floor: number, ms: number): void {
  for (let y = Math.max(0, top); y < floor; y += 1) {
    const spread = 2 + Math.round(((y - top) / Math.max(1, floor - top)) * 2);
    for (let dx = -spread; dx <= spread; dx += 1) {
      const under = bitmap.pixels[y * bitmap.width + centerX + dx] ?? 0x000000;
      const isRipple = (y + Math.floor(ms / 70)) % 4 === 0;
      const amount = Math.abs(dx) === spread ? 0.25 : isRipple ? 0.55 : 0.35;
      setPixel({ bitmap, x: centerX + dx, y, color: mixColors({ from: under, to: 0xfff3b0, amount }) });
    }
  }
}

// Tossed up out of the hatch to either side, then falling to the ground.
function drawConfetti(bitmap: Bitmap, ms: number, x: number, y: number, floor: number): void {
  for (let piece = 0; piece < 6; piece += 1) {
    const t = ((ms + piece * 230) % 1400) / 1400;
    const side = piece % 2 === 0 ? -1 : 1;
    setPixel({
      bitmap,
      x: x + side * (2 + t * 8 + (piece % 3)),
      y: y - 3 * Math.sin(t * Math.PI) + t * t * (floor - y),
      color: CONFETTI[piece % CONFETTI.length] ?? WHITE,
    });
  }
}

// `/alien stats`: the UFO with the furball in its top hatch, the beam, and the robot.
function drawParty(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (!isPresenting(alien)) return;
  const ms = STATS_MS - alien.statsMs;
  const pose = partyPose(ms);
  const layout = partyLayout(floor);
  const startY = -PARTY_UFO_ROWS.length - FURBALL_ROWS.length;
  const ufoY = Math.round(startY + (layout.hoverY - startY) * pose.ufo);
  const hatchY = ufoY + PARTY_UFO_ROWS.length;
  const centerX = layout.ufoX + Math.floor(PARTY_UFO_WIDTH / 2);
  if (pose.isBeamOn) drawTractorBeam(bitmap, centerX, hatchY, floor, ms);
  // Drawn before the UFO, so it is still half inside the hatch as the beam starts.
  if (pose.robot !== undefined) {
    const sprite = pose.isHighFive ? ROBOT.highFive : ROBOT.idle;
    const fromY = hatchY - 3;
    const groundY = floor - sprite.height;
    const hop =
      pose.phase === "party" && !pose.isHighFive
        ? Math.round(1.5 * Math.abs(Math.sin(ms / 180 + 1)))
        : 0;
    const y = Math.round(fromY + (groundY - fromY) * pose.robot) - hop;
    stamp({ target: bitmap, source: sprite, x: layout.robotX, y });
    if (Math.floor(ms / 300) % 2 === 1)
      setPixel({ bitmap, x: layout.robotX + ROBOT_LAMP.x, y: y + ROBOT_LAMP.y, color: 0x5a1a2a });
  }
  const lit = Math.floor(ms / 120);
  const flash = Math.floor(ms / 80) % 2 === 0 ? WHITE : (UFO_LIGHTS[lit % UFO_LIGHTS.length] ?? WHITE);
  paintRows(bitmap, PARTY_UFO_ROWS, layout.ufoX, ufoY, (cell, column) => {
    if (cell === "L") return pose.isFinale ? flash : UFO_LIGHTS[(column + lit) % UFO_LIGHTS.length];
    if (cell === "h") return pose.isBeamOn ? 0xfff3b0 : FLYER_COLORS.d;
    return FLYER_COLORS[cell];
  });
  const furX = layout.ufoX + Math.floor((PARTY_UFO_WIDTH - (FURBALL_ROWS[0]?.length ?? 0)) / 2);
  const furY = ufoY - 2;
  paintRows(bitmap, FURBALL_ROWS, furX, furY, (cell) => FRIEND_PALETTE[cell]);
  // It waves an arm over the rim once the robot is down.
  if (pose.phase === "party") {
    const isUp = Math.floor(ms / 220) % 2 === 0;
    setPixel({ bitmap, x: furX + 7, y: furY + (isUp ? 0 : 1), color: FRIEND_PALETTE.f ?? WHITE });
    setPixel({ bitmap, x: furX + 7, y: furY + 2, color: FRIEND_PALETTE.f ?? WHITE });
    drawConfetti(bitmap, ms, centerX, furY, floor);
  }
}

export const QUESTION_COLOR = 0xffd84a;

// Waiting on the person: a question mark beside the head, where the short pane has room.
function drawAsk(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (alien.askMs <= 0) return;
  drawGlyph(bitmap, QUESTION, HOME_X + 14, floor - ALIEN_HEIGHT, QUESTION_COLOR);
}

const STAT_KINDS: readonly MonsterKind[] =["slime", "eyeworm", "moth", "squid"];

function drawGlyph(bitmap: Bitmap, rows: readonly string[], x: number, y: number, color: Color): void {
  paintRows(bitmap, rows, x, y, (cell) => (cell === "#" ? color : undefined));
}

function numberWidth(value: number): number {
  return String(value).length * 4 - 1;
}

function drawNumber(bitmap: Bitmap, value: number, x: number, y: number, color: Color): void {
  Array.from(String(value)).forEach((digit, index) =>
    drawGlyph(bitmap, DIGITS[digit] ?? [], x + index * 4, y, color),
  );
}

// A dark see-through panel with a violet rim, faded in by `shown`.
function drawBoard(
  bitmap: Bitmap,
  box: { left: number; right: number; top: number; bottom: number },
  shown: number,
): void {
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      const isEdge = y === box.top || y === box.bottom || x === box.left || x === box.right;
      const under = bitmap.pixels[y * bitmap.width + x] ?? 0x000000;
      const color = isEdge
        ? mixColors({ from: under, to: 0x8a6ad8, amount: shown })
        : mixColors({ from: under, to: 0x0b0b1e, amount: 0.82 * shown });
      setPixel({ bitmap, x, y, color });
    }
  }
}

// `/alien stats`: a board fades in, counts the total up from zero, then shows each creature
// (and the boss) with its count, each popping in white with a hop.
function drawStats(
  bitmap: Bitmap,
  alien: Alien,
  stats: { tally: Tally; slain: number; bosses: number },
  floor: number,
): void {
  if (alien.statsMs <= 0) return;
  const elapsed = STATS_MS - alien.statsMs;
  // Clear of the robot and the UFO beside the alien, where the pane is wide enough.
  const left = Math.min(HOME_X + 25, bitmap.width - 30);
  const right = bitmap.width - 2;
  const top = 1;
  const bottom = floor - 2;
  const shown = Math.min(1, elapsed / 200, alien.statsMs / 250);
  drawBoard(bitmap, { left, right, top, bottom }, shown);
  if (shown < 1) return;
  const centerX = (left + right) / 2;
  const textY = Math.round((top + bottom) / 2 - 2);
  if (elapsed < STATS_TOTAL_MS) {
    const count = Math.round(stats.slain * Math.min(1, elapsed / (STATS_TOTAL_MS * 0.7)));
    const x = Math.round(centerX - (7 + numberWidth(count)) / 2);
    drawGlyph(bitmap, STAR, x, textY, Math.floor(elapsed / 150) % 2 === 0 ? 0xffe066 : 0xfff3b0);
    drawNumber(bitmap, count, x + 7, textY, 0xffe066);
    return;
  }
  const index = Math.min(4, Math.floor((elapsed - STATS_TOTAL_MS) / STATS_ENTRY_MS));
  const local = elapsed - STATS_TOTAL_MS - index * STATS_ENTRY_MS;
  const hop = local < 160 ? -Math.round(Math.sin((local / 160) * Math.PI) * 2) : 0;
  const kind = STAT_KINDS[index];
  const sprite = kind ? MONSTER_FRAMES[kind][0] : undefined;
  const count = kind ? stats.tally[kind] : stats.bosses;
  const iconWidth = sprite ? sprite.width : 5;
  const iconHeight = sprite ? sprite.height : 5;
  const x = Math.round(centerX - (iconWidth + 7 + numberWidth(count)) / 2);
  const iconY = Math.round((top + bottom) / 2 - iconHeight / 2) + hop;
  if (sprite) stamp({ target: bitmap, source: sprite, x, y: iconY, tint: local < 100 ? whiten : undefined });
  else drawGlyph(bitmap, SKULL, x, iconY, local < 100 ? WHITE : 0xff8fa3);
  drawGlyph(bitmap, TIMES, x + iconWidth + 2, textY, 0xa9b3d9);
  drawNumber(bitmap, count, x + iconWidth + 6, textY, WHITE);
}

function drawOrb(bitmap: Bitmap, orb: Orb): void {
  const x = Math.round(orb.x);
  const pulse = Math.floor(orb.ageMs / 90) % 2 === 0;
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].forEach(([dx, dy]) =>
    setPixel({ bitmap, x: x + (dx ?? 0), y: orb.y + (dy ?? 0), color: 0xb84dff }),
  );
  setPixel({ bitmap, x, y: orb.y, color: pulse ? 0xffffff : 0xffe066 });
  setPixel({ bitmap, x: x + 2, y: orb.y, color: 0x5a1a8a });
  setPixel({ bitmap, x: x + 3, y: orb.y + (pulse ? -1 : 1), color: 0x3a1460 });
}

// Thick at the muzzle and tapering toward the target, with a glint running down its length.
function drawBeam(bitmap: Bitmap, alien: Alien, floor: number): void {
  if (alien.mode !== "fire") return;
  const progress = alien.modeMs / BEAM_MS;
  const muzzle = muzzleOf(floor);
  const startX = muzzle.x;
  const reach = Math.min(1, progress * 2.2);
  const endX = startX + (alien.targetX - startX) * reach;
  const length = Math.max(1, endX - startX);
  const fading = progress > 0.75;
  const core: Color = fading ? 0xd9a6ff : 0xffffff;
  const edge: Color = fading ? 0x7a3db8 : 0xff6ad5;
  for (let x = startX; x <= endX; x += 1) {
    const along = (x - startX) / length;
    const flicker = (x + Math.floor(alien.modeMs / 30)) % 4;
    setPixel({ bitmap, x, y: muzzle.y, color: core });
    if ((!fading || flicker === 0) && along < 0.85) {
      setPixel({ bitmap, x, y: muzzle.y - 1, color: flicker === 0 ? 0xffb3ec : edge });
      setPixel({ bitmap, x, y: muzzle.y + 1, color: flicker === 2 ? 0xffb3ec : edge });
    }
    if (!fading && along < 0.18) {
      setPixel({ bitmap, x, y: muzzle.y - 2, color: 0x7a3db8 });
      setPixel({ bitmap, x, y: muzzle.y + 2, color: 0x7a3db8 });
    }
  }
  if (!fading) {
    const glint = startX + ((alien.modeMs % 110) / 110) * length;
    setPixel({ bitmap, x: glint, y: muzzle.y, color: 0xfff3b0 });
    setPixel({ bitmap, x: glint - 1, y: muzzle.y, color: 0xffe066 });
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
  orbs: readonly Orb[];
  flyers: readonly Flyer[];
  effects: readonly Effect[];
  stats: { tally: Tally; slain: number; bosses: number };
}): void {
  const { bitmap, alien, floor } = options;
  drawSky({ bitmap, sky: options.sky, clockMs: alien.clockMs, floor });
  options.flyers.forEach((flyer) => drawFlyer(bitmap, flyer));
  drawOutpost(bitmap, options.mode, alien.clockMs, floor);
  if (options.boss) drawBoss(bitmap, options.boss, floor);
  options.monsters.forEach((monster) => drawMonster(bitmap, monster, floor));
  drawBag(bitmap, alien, floor);
  drawStats(bitmap, alien, options.stats, floor);
  drawParty(bitmap, alien, floor);
  drawAlien(bitmap, alien, floor);
  drawAsk(bitmap, alien, floor);
  options.orbs.forEach((orb) => drawOrb(bitmap, orb));
  drawBeam(bitmap, alien, floor);
  options.effects.forEach((effect) => drawEffect({ bitmap, effect }));
}
