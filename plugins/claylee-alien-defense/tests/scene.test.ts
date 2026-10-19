import { expect, test } from "claude-code/testing";

import { boardLeft, partyLayout } from "../hooks/draw/scene";
import { FRAME_MS, floorOf, MAX_COLUMNS, STAGE_ROWS, TALL_ROWS } from "../hooks/sim/constants";
import type { Mode } from "../hooks/sim/types";
import { createWorld } from "../hooks/sim/world";

const stage = (phase: "dawn" | "noon" | "dusk" | "night"): Mode => ({
  kind: "openspec",
  change: "idle-logout",
  phase,
  docs: phase === "dawn" ? 4 : 6,
  done: 0,
  total: 5,
  others: 0,
});

function run(world: ReturnType<typeof createWorld>, ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) world.tick(FRAME_MS);
}

function frameOf(mode: Mode): { sky: string; ground: string } {
  const world = createWorld();
  world.setMode(mode);
  const { pixels, width } = world.frame();
  const floor = floorOf(STAGE_ROWS * 2);
  return {
    sky: pixels.slice(width, width * 2).join(","),
    ground: pixels.slice(floor * width, (floor + 1) * width).join(","),
  };
}

// The night stage keeps patrol's sky and tells itself apart by its ground.
test("each stage paints a sky of its own, and the night stage a ground of its own", async () => {
  const days: Mode[] = [{ kind: "free" }, stage("dawn"), stage("noon"), stage("dusk")];
  expect(new Set(days.map((mode) => frameOf(mode).sky)).size).toBe(days.length);
  expect(frameOf(stage("night")).ground).not.toBe(frameOf({ kind: "free" }).ground);
});

test("the stats party hangs a UFO over the alien and stands a robot beside it", async () => {
  const quiet = createWorld();
  const party = createWorld();
  [quiet, party].forEach((world) => world.resize(MAX_COLUMNS, TALL_ROWS));
  party.showStats();
  run(quiet, 2000);
  run(party, 2000);
  const before = quiet.frame().pixels.slice();
  const { pixels, width } = party.frame();
  const floor = floorOf(TALL_ROWS * 2);
  const layout = partyLayout(floor);
  const changedIn = (left: number, right: number, top: number, bottom: number): number => {
    let changed = 0;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        if (before[y * width + x] !== pixels[y * width + x]) changed += 1;
      }
    }
    return changed;
  };
  expect(changedIn(layout.ufoX, layout.ufoX + 13, layout.hoverY, layout.hoverY + 5)).toBeGreaterThan(20);
  expect(changedIn(layout.robotX, layout.robotX + 7, floor - 10, floor)).toBeGreaterThan(20);
});

test("the stats party sparks on each high-five and ends on fireworks", async () => {
  const world = createWorld();
  world.resize(MAX_COLUMNS, TALL_ROWS);
  world.showStats();
  let sparks = 0;
  let fireworks = 0;
  for (let elapsed = 0; elapsed < 6000; elapsed += FRAME_MS) {
    const seen = new Set(world.effects());
    world.tick(FRAME_MS);
    world.effects().forEach((effect) => {
      if (seen.has(effect)) return;
      if (effect.kind === "sparkle") sparks += 1;
      if (effect.kind === "firework") fireworks += 1;
    });
  }
  expect(sparks).toBe(5);
  expect(fireworks).toBe(2);
});

// Inside its rim the board is a dark panel; confetti or a firework there would be bright.
test("the stats party keeps its confetti and fireworks off the board", async () => {
  const world = createWorld();
  world.resize(MAX_COLUMNS, TALL_ROWS);
  world.showStats();
  const floor = floorOf(TALL_ROWS * 2);
  const left = boardLeft(MAX_COLUMNS);
  let brightest = 0;
  for (let elapsed = 0; elapsed < 5600; elapsed += FRAME_MS) {
    world.tick(FRAME_MS);
    if (elapsed < 300) continue;
    const { pixels, width } = world.frame();
    for (let y = 2; y < floor - 3; y += 1) {
      // The strip inside the left rim, short of the counts in the middle.
      for (let x = left + 1; x < left + 9; x += 1) {
        const color = pixels[y * width + x] ?? 0;
        brightest = Math.max(brightest, (color >> 16) & 255, (color >> 8) & 255, color & 255);
      }
    }
  }
  expect(brightest).toBeLessThan(0x80);
});

test("a creature on the field is drawn where it stands", async () => {
  const empty = createWorld();
  const busy = createWorld();
  empty.setMode(stage("noon"));
  busy.setMode(stage("noon"));
  busy.spawn("Read");
  run(empty, 3000);
  run(busy, 3000);
  const monster = busy.monsters()[0];
  expect(monster).toBeDefined();
  const floor = floorOf(STAGE_ROWS * 2);
  const left = Math.round(monster?.x ?? 0);
  const before = empty.frame().pixels.slice();
  const after = busy.frame().pixels;
  const width = busy.frame().width;
  let changed = 0;
  for (let y = floor - 12; y < floor; y += 1) {
    for (let x = left; x < left + 13 && x < width; x += 1) {
      if (before[y * width + x] !== after[y * width + x]) changed += 1;
    }
  }
  expect(changed).toBeGreaterThan(20);
});
