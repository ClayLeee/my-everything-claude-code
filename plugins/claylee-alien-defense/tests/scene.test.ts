import { expect, test } from "claude-code/testing";

import { boardLeft, visitLayout } from "../hooks/draw/scene";
import { FRAME_MS, floorOf, HOME_X, MAX_COLUMNS, STAGE_ROWS, TALL_ROWS } from "../hooks/sim/constants";
import { ARRIVE_MS } from "../hooks/sim/routines";
import type { Mode } from "../hooks/sim/types";
import { createWorld } from "../hooks/sim/world";

const stage = (phase: "dawn" | "noon" | "dusk" | "night"): Mode => ({
  kind: "openspec",
  change: "idle-logout",
  phase,
  docs: phase === "dawn" ? 3 : 4,
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

// Pixels that differ from a world left alone, inside a box.
function changedIn(
  quiet: ReturnType<typeof createWorld>,
  busy: ReturnType<typeof createWorld>,
  box: { left: number; right: number; top: number; bottom: number },
): number {
  const before = quiet.frame().pixels.slice();
  const { pixels, width } = busy.frame();
  let changed = 0;
  for (let y = box.top; y < box.bottom; y += 1)
    for (let x = box.left; x < box.right; x += 1)
      if (before[y * width + x] !== pixels[y * width + x]) changed += 1;
  return changed;
}

const tallPair = () => {
  const quiet = createWorld();
  const busy = createWorld();
  [quiet, busy].forEach((world) => world.resize(MAX_COLUMNS, TALL_ROWS));
  return { quiet, busy, floor: floorOf(TALL_ROWS * 2) };
};

test("the stats visit hangs the UFO over the alien and takes it aboard", async () => {
  const { quiet, busy, floor } = tallPair();
  busy.showStats();
  run(quiet, 2000);
  run(busy, 2000);
  const layout = visitLayout(floor);
  const ufo = { left: layout.ufoX, right: layout.ufoX + 13, top: layout.hoverY, bottom: layout.hoverY + 5 };
  expect(changedIn(quiet, busy, ufo)).toBeGreaterThan(20);
  // Aboard, the spot where the alien stood is empty.
  const spot = { left: HOME_X, right: HOME_X + 15, top: floor - 12, bottom: floor };
  expect(changedIn(quiet, busy, spot)).toBeGreaterThan(40);
});

test("the stats visit shoots the alien back down with dust and a held beat, and ends on fireworks", async () => {
  const world = createWorld();
  world.resize(MAX_COLUMNS, TALL_ROWS);
  world.showStats();
  let dust = 0;
  let fireworks = 0;
  let held = 0;
  for (let elapsed = 0; elapsed < 7000; elapsed += FRAME_MS) {
    const seen = new Set(world.effects());
    const before = world.alien().statsMs;
    world.tick(FRAME_MS);
    // A held tick leaves the clock where it was.
    if (before > 0 && world.alien().statsMs === before) held += 1;
    world.effects().forEach((effect) => {
      if (seen.has(effect)) return;
      if (effect.kind === "dust") dust += 1;
      if (effect.kind === "firework") fireworks += 1;
    });
  }
  expect(dust).toBe(1);
  expect(held).toBeGreaterThanOrEqual(1);
  expect(fireworks).toBe(2);
});

// Inside its rim the board is a dark panel; a firework there would be bright.
test("the stats visit keeps its fireworks off the board", async () => {
  const world = createWorld();
  world.resize(MAX_COLUMNS, TALL_ROWS);
  world.showStats();
  const floor = floorOf(TALL_ROWS * 2);
  const left = boardLeft(MAX_COLUMNS);
  let brightest = 0;
  for (let elapsed = 0; elapsed < 6400; elapsed += FRAME_MS) {
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

test("a new session brings the alien down the UFO's beam, and creatures wait for it to land", async () => {
  const { quiet, busy, floor } = tallPair();
  busy.arriveByUfo();
  run(quiet, 300);
  run(busy, 300);
  // Still aboard the UFO coming in: nobody on the ground yet.
  const spot = { left: HOME_X, right: HOME_X + 15, top: floor - 12, bottom: floor };
  expect(changedIn(quiet, busy, spot)).toBeGreaterThan(40);
  busy.spawn("Read");
  let dust = 0;
  for (let elapsed = 0; elapsed < ARRIVE_MS; elapsed += FRAME_MS) {
    const seen = new Set(busy.effects());
    if (busy.alien().arriveMs > 0) expect(busy.alien().mode).toBe("idle");
    busy.tick(FRAME_MS);
    busy.effects().forEach((effect) => {
      if (!seen.has(effect) && effect.kind === "dust") dust += 1;
    });
  }
  expect(dust).toBe(1);
  expect(busy.alien().arriveMs).toBe(0);
  run(busy, 600);
  expect(busy.alien().mode).not.toBe("idle");
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
