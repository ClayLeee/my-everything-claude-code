import { expect, test } from "claude-code/testing";

import { ALIEN } from "../hooks/art/alien";
import type { Bitmap } from "../hooks/shared/pixel/bitmap";
import { BREATH_MS, flexPose, liftPose, sleepPose } from "../hooks/sim/routines";

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
