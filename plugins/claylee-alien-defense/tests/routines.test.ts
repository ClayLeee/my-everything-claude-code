import { expect, test } from "claude-code/testing";

import { ALIEN, ALIEN_PALETTE } from "../hooks/art/alien";
import { ROBOT } from "../hooks/art/friends";
import type { Bitmap } from "../hooks/shared/pixel/bitmap";
import { STATS_ENTRY_MS, STATS_MS, STATS_TOTAL_MS } from "../hooks/sim/constants";
import { BREATH_MS, flexPose, liftPose, partyPose, sleepPose } from "../hooks/sim/routines";

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
  expect(sameBitmap(ALIEN.highFive, ALIEN.windup)).toBe(false);
  expect(ALIEN.cheerCrouch.height).toBe(ALIEN.cheer.height - 1);
  expect(sameBitmap(ROBOT.idle, ROBOT.highFive)).toBe(false);
  expect(sameBitmap(ROBOT.crouch, ROBOT.windup)).toBe(false);
  expect(ROBOT.crouch.height).toBe(ROBOT.idle.height - 1);
});

// Pink stays on the gun's emitter only; over the head every pose wears two green antennae.
test("every pose wears twin green antennae and no pink one", () => {
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
  expect(top.filter((color) => color === ALIEN_PALETTE.L).length).toBe(2);
});

// The eyes are solid gray: no white of the eye and no pupil.
test("every pose has solid gray eyes with no pupils", () => {
  Object.entries(ALIEN).forEach(([name, sprite]) => {
    expect([name, sprite.pixels.includes(ALIEN_PALETTE.k)]).toEqual([name, false]);
  });
  expect(ALIEN.stand.pixels.filter((pixel) => pixel === ALIEN_PALETTE.e).length).toBe(8);
});

test("the stats party lands the robot before the first line and high-fives on every line", () => {
  const poses = sample(partyPose, STATS_MS);
  const landed = partyPose(STATS_TOTAL_MS);
  expect(landed.phase).toBe("party");
  expect(landed.robot).toBe(1);
  // One slap per board line: four creatures and the boss.
  const slaps = poses.filter((pose, index) => pose.isSlap && !poses[index - 1]?.isSlap);
  expect(slaps.length).toBe(5);
  expect(slaps.every((pose) => pose.isHighFive)).toBe(true);
  // The finale comes with the boss line only.
  const finale = poses.filter((pose) => pose.isFinale);
  expect(finale.length).toBeGreaterThan(0);
  expect(finale.every((pose) => pose.entry === 4)).toBe(true);
  expect(partyPose(STATS_TOTAL_MS + 4 * STATS_ENTRY_MS + 200).isFinale).toBe(true);
  // The UFO comes down, takes the robot back and is gone as the board fades.
  expect(partyPose(0).ufo).toBe(0);
  const last = partyPose(STATS_MS - 1);
  expect(last.robot).toBeUndefined();
  expect(last.ufo).toBeLessThan(0.1);
  expect(poses.some((pose) => pose.phase === "lift" && pose.beam > 0)).toBe(true);
});

test("each party move comes in beats: hatch, beam, drop; windup, slap, recoil; crouch, air, land", () => {
  const poses = sample(partyPose, STATS_MS, 10);
  const firstAt = (match: (pose: ReturnType<typeof partyPose>) => boolean): number =>
    poses.findIndex(match);
  // The hatch opens before the beam reaches out, and the beam is down before the robot leaves.
  expect(firstAt((pose) => pose.hatch > 0)).toBeLessThan(firstAt((pose) => pose.beam > 0));
  expect(firstAt((pose) => pose.beam === 1)).toBeLessThanOrEqual(
    firstAt((pose) => pose.robot !== undefined),
  );
  expect(poses.some((pose) => pose.phase === "beam" && pose.robotSway !== 0)).toBe(true);
  expect(poses.some((pose) => pose.isLanding && pose.robotHop.isCrouched)).toBe(true);
  // Every line runs windup, slap, recoil in that order, the alien crouched on the windup.
  const order = poses.map((pose) => pose.five).filter((five, index, all) => five && five !== all[index - 1]);
  expect(order.join(",")).toBe(Array(5).fill("windup,slap,recoil").join(","));
  expect(poses.filter((pose) => pose.five === "windup").every((pose) => pose.alien.isCrouched)).toBe(true);
  // Hops start and end in a crouch, and the two take turns rather than jump together.
  const party = poses.filter((pose) => pose.phase === "party" && !pose.five && !pose.isFinale);
  expect(party.some((pose) => pose.alien.isCrouched)).toBe(true);
  expect(party.some((pose) => pose.alien.lift > 0 && pose.robotHop.lift === 0)).toBe(true);
  expect(party.some((pose) => pose.robotHop.lift > 0 && pose.alien.lift === 0)).toBe(true);
  // At the finale they jump together, higher than any hop.
  const hopHeight = Math.max(...party.map((pose) => pose.alien.lift));
  const finale = poses.filter((pose) => pose.isFinale && pose.alien.lift > 0);
  expect(finale.every((pose) => pose.robotHop.lift === pose.alien.lift)).toBe(true);
  expect(Math.max(...finale.map((pose) => pose.alien.lift))).toBeGreaterThan(hopHeight);
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
