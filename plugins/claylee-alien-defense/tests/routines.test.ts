import { expect, test } from "claude-code/testing";

import { ALIEN, ALIEN_PALETTE } from "../hooks/art/alien";
import type { Bitmap } from "../hooks/shared/pixel/bitmap";
import { STATS_ENTRY_MS, STATS_MS, STATS_TOTAL_MS } from "../hooks/sim/constants";
import {
  ARRIVE_MS,
  arrivePose,
  BREATH_MS,
  flexPose,
  liftPose,
  sleepPose,
  statsPose,
} from "../hooks/sim/routines";
import type { VisitPose } from "../hooks/sim/routines";

const sample = <T>(pose: (ms: number) => T, untilMs: number, stepMs = 20): T[] => {
  const poses: T[] = [];
  for (let ms = 0; ms < untilMs; ms += stepMs) poses.push(pose(ms));
  return poses;
};

const sameBitmap = (a: Bitmap, b: Bitmap): boolean => JSON.stringify(a) === JSON.stringify(b);

test("every pose variant differs from the frame it was cut from", () => {
  expect(sameBitmap(ALIEN.liftPress, ALIEN.liftStrain)).toBe(false);
  expect(sameBitmap(ALIEN.liftRest, ALIEN.liftPant)).toBe(false);
  expect(sameBitmap(ALIEN.flexFront, ALIEN.flexFrontPump)).toBe(false);
  expect(sameBitmap(ALIEN.sleep, ALIEN.sleepAway)).toBe(false);
  expect(sameBitmap(ALIEN.sleepBreath, ALIEN.sleepAwayBreath)).toBe(false);
  expect(sameBitmap(ALIEN.cheer, ALIEN.cheerWave)).toBe(false);
  expect(sameBitmap(ALIEN.cheer, ALIEN.cheerUp)).toBe(false);
  expect(sameBitmap(ALIEN.cheerWave, ALIEN.cheerWaveUp)).toBe(false);
  expect(ALIEN.cheerCrouch.height).toBe(ALIEN.cheer.height - 1);
});

// Pink stays on the gun's emitter only; over the head every pose wears one green antenna.
test("every pose wears one green antenna and no pink one", () => {
  const pink = new Set<number>([ALIEN_PALETTE.a, ALIEN_PALETTE.A]);
  Object.entries(ALIEN).forEach(([name, sprite]) => {
    const rows = Array.from({ length: sprite.height }, (_, y) =>
      sprite.pixels.slice(y * sprite.width, (y + 1) * sprite.width),
    );
    const head = rows.findIndex((row) => row.includes(ALIEN_PALETTE.o));
    const above = rows.slice(0, head).flat();
    expect([name, above.some((color) => color !== null && pink.has(color))]).toEqual([name, false]);
  });
  const top = ALIEN.stand.pixels.slice(0, ALIEN.stand.width);
  expect(top.filter((color) => color === ALIEN_PALETTE.L).length).toBe(1);
});

// The eyes are gray with a darker gray where the pupil was: no white of the eye, no black pupil.
test("every pose has gray eyes and no black pupils", () => {
  Object.entries(ALIEN).forEach(([name, sprite]) => {
    expect([name, sprite.pixels.includes(ALIEN_PALETTE.k)]).toEqual([name, false]);
  });
  const count = (color: number) => ALIEN.stand.pixels.filter((pixel) => pixel === color).length;
  expect([count(ALIEN_PALETTE.e), count(ALIEN_PALETTE.E)]).toEqual([6, 2]);
  expect(sameBitmap(ALIEN.cheer, ALIEN.cheerUp)).toBe(false);
});

test("the stats visit takes the alien up the beam, flashes on every line and shoots it back down", () => {
  const poses = sample(statsPose, STATS_MS, 10);
  const firstAt = (match: (pose: VisitPose) => boolean): number => poses.findIndex(match);
  // It watches the UFO come in; the hatch opens before the beam reaches out, and the beam is
  // all the way down before the alien leaves the ground.
  expect(statsPose(300).isLookingUp).toBe(true);
  expect(firstAt((pose) => pose.hatch > 0)).toBeLessThan(firstAt((pose) => pose.beam > 0));
  expect(firstAt((pose) => pose.beam === 1)).toBeLessThanOrEqual(firstAt((pose) => (pose.rise ?? 1) > 0));
  expect(poses.some((pose) => pose.phase === "carry" && pose.sway !== 0)).toBe(true);
  // Aboard while the board's lines come up: a flash at the start of each of the five.
  expect(statsPose(STATS_TOTAL_MS).rise).toBeUndefined();
  const flashes = poses.filter((pose, index) => pose.isFlash && !poses[index - 1]?.isFlash);
  expect(flashes.length).toBe(5);
  // The finale comes with the boss line only.
  const finale = poses.filter((pose) => pose.isFinale);
  expect(finale.length).toBeGreaterThan(0);
  expect(finale.every((pose) => pose.entry === 4)).toBe(true);
  expect(statsPose(STATS_TOTAL_MS + 4 * STATS_ENTRY_MS + 200).isFinale).toBe(true);
  // Shot back out after it boards, landing crouched where it stood, and the UFO is gone as
  // the board fades.
  const spat = firstAt((pose) => pose.phase === "spit" && pose.rise !== undefined);
  expect(spat).toBeGreaterThan(firstAt((pose) => pose.phase === "aboard"));
  expect(poses.slice(spat).some((pose) => pose.isLanding && pose.rise === 0)).toBe(true);
  expect(statsPose(0).ufo).toBe(0);
  expect(statsPose(STATS_MS - 1).ufo).toBeLessThan(0.1);
  expect(statsPose(STATS_MS - 1).rise).toBe(0);
});

test("a new session brings the alien down the beam and the UFO leaves", () => {
  const poses = sample(arrivePose, ARRIVE_MS, 10);
  // Aboard while the UFO comes in, then carried down from the hatch to the ground.
  expect(arrivePose(300).rise).toBeUndefined();
  const carried = poses.filter((pose) => pose.phase === "carry").map((pose) => pose.rise ?? 0);
  expect(carried[0]).toBeGreaterThan(0.9);
  expect(carried.every((rise, index) => index === 0 || rise <= (carried[index - 1] ?? 1))).toBe(true);
  expect(poses.some((pose) => pose.isLanding)).toBe(true);
  expect(arrivePose(ARRIVE_MS - 1).ufo).toBeLessThan(0.1);
  expect(arrivePose(ARRIVE_MS - 1).rise).toBe(0);
});

test("a lift grinds up slower than it comes down and rests after a set", () => {
  const poses = sample(liftPose, 12000);
  const count = (phase: string) => poses.filter((pose) => pose.phase === phase).length;
  expect(count("press") + count("strain")).toBeGreaterThan(count("lower"));
  expect(count("rest")).toBeGreaterThan(0);
  expect(poses.some((pose) => pose.phase === "strain" && pose.shakeX !== 0)).toBe(true);
  expect(poses.every((pose) => pose.phase === "strain" || pose.shakeX === 0)).toBe(true);
});

test("sleep breathes out longer than in, pops its bubble and rolls over within an idle spell", () => {
  const poses = sample(sleepPose, 15000);
  const breath = poses.filter((pose) => pose.breath === 0);
  expect(breath.filter((pose) => pose.isExhaling).length).toBeGreaterThan(
    breath.filter((pose) => !pose.isExhaling && pose.fill > 0).length,
  );
  expect(poses.some((pose) => pose.popMs !== undefined)).toBe(true);
  expect(poses.some((pose) => pose.isFacingAway)).toBe(true);
  expect(poses.some((pose) => pose.tossY > 0)).toBe(true);
  expect(poses.filter((pose) => pose.isFacingAway).every((pose) => pose.bubble === undefined)).toBe(
    true,
  );
  // The bubble grows through the out-breath.
  const out = breath.filter((pose) => pose.isExhaling);
  expect((out.at(-1)?.bubble ?? 0) > (out[0]?.bubble ?? 1)).toBe(true);
  expect(BREATH_MS).toBeGreaterThan(4000);
});

test("flexing breathes in, snaps, trembles under tension and cycles through three shots", () => {
  const poses = sample(flexPose, 9000);
  expect(new Set(poses.map((pose) => pose.shot)).size).toBe(3);
  expect(poses.some((pose) => pose.phase === "breathe" && pose.dipY === 1)).toBe(true);
  expect(poses.some((pose) => pose.phase === "snap")).toBe(true);
  expect(poses.some((pose) => pose.phase === "hit" && pose.shakeX === 1)).toBe(true);
  expect(poses.every((pose) => pose.phase === "hit" || pose.shakeX === 0)).toBe(true);
});
