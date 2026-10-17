import { expect, test } from "claude-code/testing";

import { countTasks, phaseOf } from "../hooks/openspec";
import { BOSS_HITS, FRAME_MS, STAGE_ROWS, TALL_ROWS } from "../hooks/sim/constants";
import type { Mode } from "../hooks/sim/types";
import { createWorld } from "../hooks/sim/world";

function run(world: ReturnType<typeof createWorld>, ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) world.tick(FRAME_MS);
}

const openspec = (phase: "dawn" | "noon" | "dusk" | "night", change = "idle-logout"): Mode => ({
  kind: "openspec",
  change,
  phase,
  docs: phase === "dawn" ? 4 : 6,
  done: 0,
  total: 5,
});

test("the stage follows the documents and then the task boxes", async () => {
  expect(phaseOf({ docs: 4, done: 0, total: 5 })).toBe("dawn");
  expect(phaseOf({ docs: 6, done: 0, total: 5 })).toBe("noon");
  expect(phaseOf({ docs: 6, done: 2, total: 5 })).toBe("noon");
  expect(phaseOf({ docs: 6, done: 3, total: 5 })).toBe("dusk");
  expect(phaseOf({ docs: 6, done: 5, total: 5 })).toBe("night");
  expect(countTasks("- [x] a\n- [ ] b\n  - [X] c\nnot - [x] d")).toEqual({ done: 2, total: 3 });
});

test("a tool call brings a monster that the laser kills once the call ends", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const id = world.spawn();
  run(world, 1000);
  expect(world.slain()).toBe(0);
  world.defeat({ id, isFailure: false });
  run(world, 6000);
  expect(world.slain()).toBe(1);
  expect(world.tally().slime).toBe(1);
});

test("a failed call costs a second shot", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const id = world.spawn();
  world.defeat({ id, isFailure: true });
  run(world, 6000);
  expect(world.slain()).toBe(1);
  expect(world.log().some((line) => line.includes("擋下了一發雷射"))).toBe(true);
});

test("the first stage seen summons no boss, an advance does, and it takes every hit", async () => {
  const world = createWorld();
  world.setMode(openspec("dawn"));
  expect(world.boss()).toBeUndefined();
  world.setMode(openspec("noon"));
  expect(world.boss()?.title).toBe("規格吞噬者");
  run(world, 6000);
  const hits = world.boss()?.hitsRemaining ?? 0;
  expect(hits).toBeLessThan(BOSS_HITS);
  run(world, 20000);
  expect(world.boss()).toBeUndefined();
  expect(world.bossesSlain()).toBe(1);
});

test("archiving a change summons the night boss and returns to patrol", async () => {
  const world = createWorld();
  world.setMode(openspec("night"));
  world.setMode({ kind: "free" });
  expect(world.boss()?.title).toBe("歸檔深淵獸");
  expect(world.summary()).toContain("夜間巡邏");
});

test("with nothing to fight the alien cycles through sleep, workout and flex", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const seen = new Set<string>();
  for (let step = 0; step < 120; step += 1) {
    run(world, 1000);
    seen.add(world.alien().activity);
  }
  expect([...seen].sort()).toEqual(["flex", "sleep", "workout"]);
});

test("every mode draws at the narrowest and widest pane, short and docked", async () => {
  const modes: Mode[] = [
    { kind: "free" },
    openspec("dawn"),
    openspec("noon"),
    openspec("dusk"),
    openspec("night"),
  ];
  for (const rows of [STAGE_ROWS, TALL_ROWS]) {
    for (const columns of [44, 72]) {
      for (const mode of modes) {
        const world = createWorld();
        world.resize(columns, rows);
        world.setMode({ kind: "free" });
        world.setMode(mode);
        const id = world.spawn();
        world.defeat({ id, isFailure: false });
        for (let step = 0; step < 200; step += 1) {
          world.tick(FRAME_MS);
          const bitmap = world.frame();
          expect(bitmap.width).toBe(columns);
          expect(bitmap.height).toBe(rows * 2);
        }
      }
    }
  }
});

test("the line under the scene names what the alien is doing right now", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  expect(world.summary().startsWith("睡覺中")).toBe(true);
  expect(world.log()[0]).toContain("睡袋");
  const id = world.spawn("Bash");
  run(world, 200);
  expect(world.summary().startsWith("迎戰 1 隻異形")).toBe(true);
  expect(world.log()[0]).toContain("起身迎戰");
  world.defeat({ id, isFailure: false });
  run(world, 6000);
  expect(world.log().some((line) => line === "擊倒黏液獸（Bash）")).toBe(true);
  expect(world.summary().startsWith("迎戰")).toBe(false);
  world.setMode(openspec("dawn"));
  world.setMode(openspec("noon"));
  run(world, 3000);
  expect(world.summary().startsWith("BOSS 戰：規格吞噬者")).toBe(true);
});
