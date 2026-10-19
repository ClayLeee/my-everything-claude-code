import { expect, test } from "claude-code/testing";

import { FRAME_MS, floorOf, STAGE_ROWS } from "../hooks/sim/constants";
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
