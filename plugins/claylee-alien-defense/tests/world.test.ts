import { expect, test } from "claude-code/testing";

import {
  countTasks,
  isCurrentDoc,
  latestArchiveDate,
  phaseOf,
  pickChange,
} from "../hooks/openspec";
import {
  BOSS_HITS,
  BOSS_MAX_HITS,
  BOSS_MIN_HITS,
  FRAME_MS,
  KNOCKBACK_MS,
  KNOCKBACK_PIXELS,
  LONG_CALL_MS,
  MAX_ALIVE_MONSTERS,
  STAGE_ROWS,
  TALL_ROWS,
} from "../hooks/sim/constants";
import type { Mode } from "../hooks/sim/types";
import { bossHitsFor, createWorld, kindFor } from "../hooks/sim/world";

function run(world: ReturnType<typeof createWorld>, ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) world.tick(FRAME_MS);
}

const openspec = (
  phase: "dawn" | "noon" | "dusk" | "night",
  change = "idle-logout",
  total = 5,
): Mode => ({
  kind: "openspec",
  change,
  phase,
  docs: phase === "dawn" ? 4 : 6,
  done: 0,
  total,
  others: 0,
});

test("superpowers docs count only when dated since the last archived change", async () => {
  const archive = ["2026-09-01-old-change", "2026-10-02-last-change", "notes"];
  expect(latestArchiveDate(archive)).toBe("2026-10-02");
  expect(latestArchiveDate([])).toBeUndefined();
  expect(isCurrentDoc("2026-09-30-old-design.md", "2026-10-02")).toBe(false);
  expect(isCurrentDoc("2026-10-02-new-design.md", "2026-10-02")).toBe(true);
  expect(isCurrentDoc("2026-10-15-new-design.md", "2026-10-02")).toBe(true);
  expect(isCurrentDoc("undated.md", "2026-10-02")).toBe(true);
  expect(isCurrentDoc("2026-09-30-old-design.md", undefined)).toBe(true);
  expect(isCurrentDoc("2026-10-15-image.png", undefined)).toBe(false);
});

test("with several active changes the one touched last is picked", async () => {
  expect(
    pickChange([
      { name: "alpha", touchedMs: 100 },
      { name: "beta", touchedMs: 300 },
    ]),
  ).toBe("beta");
  expect(pickChange([])).toBeUndefined();
});

test("the summary names how many other changes are open", async () => {
  const world = createWorld();
  world.setMode({ ...openspec("noon"), others: 2 } as Mode);
  expect(world.summary()).toContain("另有 2 個 change");
  world.setMode({ ...openspec("noon"), others: 0 } as Mode);
  expect(world.summary()).not.toContain("另有");
});

test("a bigger change brings a boss with more hit points", async () => {
  expect(bossHitsFor({ kind: "free" })).toBe(BOSS_HITS);
  expect(bossHitsFor(openspec("noon", "x", 0))).toBe(BOSS_HITS);
  expect(bossHitsFor(openspec("noon", "x", 2))).toBe(BOSS_MIN_HITS);
  expect(bossHitsFor(openspec("noon", "x", 14))).toBe(7);
  expect(bossHitsFor(openspec("noon", "x", 60))).toBe(BOSS_MAX_HITS);
  const world = createWorld();
  world.setMode(openspec("dusk", "big", 20));
  world.setMode(openspec("night", "big", 20));
  expect(world.boss()?.maxHits).toBe(10);
  expect(world.summary()).toContain("/10");
});

test("a call that runs long shows on the line under the scene", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const id = world.spawn("Bash");
  run(world, LONG_CALL_MS - 1000);
  expect(world.summary()).not.toContain("已等");
  run(world, 3000);
  expect(world.summary()).toContain("Bash 已等 1");
  world.defeat({ id, isFailure: false });
  expect(world.summary()).not.toContain("已等");
});

test("a tool brings the creature that matches what it does", async () => {
  expect(kindFor("Read", 1)).toBe("eyeworm");
  expect(kindFor("Grep", 1)).toBe("eyeworm");
  expect(kindFor("WebFetch", 1)).toBe("eyeworm");
  expect(kindFor("mcp__lean-ctx__ctx_read", 1)).toBe("eyeworm");
  expect(kindFor("Edit", 1)).toBe("slime");
  expect(kindFor("Write", 1)).toBe("slime");
  expect(kindFor("mcp__lean-ctx__ctx_patch", 1)).toBe("slime");
  expect(kindFor("Bash", 1)).toBe("squid");
  expect(kindFor("PowerShell", 1)).toBe("squid");
  expect(kindFor("mcp__lean-ctx__ctx_shell", 1)).toBe("squid");
  expect(kindFor("Agent", 1)).toBe("moth");
  expect(kindFor("Skill", 1)).toBe("moth");
  expect(kindFor("mcp__lean-ctx__ctx_compose", 1)).toBe("moth");
  expect(kindFor("AskUserQuestion", 1)).toBe("slime");
  expect(kindFor("AskUserQuestion", 2)).toBe("eyeworm");
});

test("a landed shot holds the scene for a beat", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  world.defeat({ id: world.spawn(), isFailure: false });
  for (let step = 0; step < 200 && (world.monsters()[0]?.flashMs ?? 0) === 0; step += 1)
    world.tick(FRAME_MS);
  const held = world.alien().modeMs;
  world.tick(FRAME_MS);
  expect(world.alien().modeMs).toBe(held);
});

test("a knocked-back monster slides back and settles instead of jumping", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const id = world.spawn();
  run(world, 4000);
  world.defeat({ id, isFailure: true });
  const monster = (): { x: number; hitsRemaining: number } =>
    world.monsters()[0] ?? { x: 0, hitsRemaining: 0 };
  for (let step = 0; step < 200 && monster().hitsRemaining === 2; step += 1) world.tick(FRAME_MS);
  const hitX = monster().x;
  const xs: number[] = [];
  for (let elapsed = 0; elapsed < KNOCKBACK_MS + 120; elapsed += FRAME_MS) {
    world.tick(FRAME_MS);
    xs.push(monster().x);
  }
  const firstMove = xs.find((x) => x !== hitX) ?? hitX;
  expect(firstMove - hitX).toBeGreaterThan(0);
  expect(firstMove - hitX).toBeLessThan(KNOCKBACK_PIXELS);
  expect(Math.round(Math.max(...xs) - hitX)).toBe(KNOCKBACK_PIXELS);
});

test("a boss spits orbs that hurt the alien", async () => {
  const world = createWorld();
  world.setMode(openspec("dawn"));
  world.setMode(openspec("noon"));
  let sawOrb = false;
  let wasHurt = false;
  for (let step = 0; step < 400 && !wasHurt; step += 1) {
    world.tick(FRAME_MS);
    sawOrb ||= world.orbs().length > 0;
    wasHurt = world.alien().hurtMs > 0;
  }
  expect(sawOrb).toBe(true);
  expect(wasHurt).toBe(true);
});

test("a kill that never reached the field still flashes far off", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const ids = Array.from({ length: MAX_ALIVE_MONSTERS + 1 }, () => world.spawn());
  world.defeat({ id: ids[ids.length - 1] ?? 0, isFailure: false });
  expect(world.slain()).toBe(1);
  expect(world.effects().some((effect) => effect.kind === "distant")).toBe(true);
});

test("monsters step out of a portal", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  world.spawn();
  expect(world.effects().some((effect) => effect.kind === "portal")).toBe(true);
});

test("waking from sleep leaves the bag behind for a moment", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  world.spawn();
  world.tick(FRAME_MS);
  expect(world.alien().bagMs).toBeGreaterThan(0);
});

test("a turn is cheered only when it brought kills", async () => {
  const quiet = createWorld();
  quiet.setMode({ kind: "free" });
  quiet.celebrate();
  run(quiet, 400);
  expect(quiet.alien().mode).not.toBe("cheer");
  const busy = createWorld();
  busy.setMode({ kind: "free" });
  busy.defeat({ id: busy.spawn(), isFailure: false });
  run(busy, 6000);
  busy.celebrate();
  run(busy, 200);
  expect(busy.alien().mode).toBe("cheer");
});

test("in free mode things cross the night sky, but not during an OpenSpec change", async () => {
  const free = createWorld();
  free.setMode({ kind: "free" });
  const kinds = new Set<string>();
  for (let step = 0; step < 6000; step += 1) {
    free.tick(FRAME_MS);
    free.flyers().forEach((flyer) => kinds.add(flyer.kind));
  }
  expect(kinds.size).toBeGreaterThan(1);
  const busy = createWorld();
  busy.setMode(openspec("noon"));
  let sawFlyer = false;
  for (let step = 0; step < 1500; step += 1) {
    busy.tick(FRAME_MS);
    sawFlyer ||= busy.flyers().length > 0;
  }
  expect(sawFlyer).toBe(false);
});

test("kills count for the session and reset clears them", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  world.defeat({ id: world.spawn("Read"), isFailure: false });
  run(world, 6000);
  expect(world.slain()).toBe(1);
  expect(world.tally().eyeworm).toBe(1);
  world.resetCounts();
  expect(world.slain()).toBe(0);
  expect(world.tally().eyeworm).toBe(0);
  expect(world.bossesSlain()).toBe(0);
});

test("stats puts up a board the alien shows off, then takes it down", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  world.showStats();
  expect(world.summary().startsWith("戰績：擊倒 0 隻")).toBe(true);
  run(world, 3000);
  expect(world.alien().statsMs).toBeGreaterThan(0);
  expect(world.alien().mode).toBe("idle");
  run(world, 4000);
  expect(world.alien().statsMs).toBe(0);
  expect(world.summary().startsWith("戰績")).toBe(false);
});

test("a failed call makes the monster blink red", async () => {
  const world = createWorld();
  world.setMode({ kind: "free" });
  const id = world.spawn();
  world.tick(FRAME_MS);
  world.defeat({ id, isFailure: true });
  expect(world.monsters()[0]?.rageMs).toBeGreaterThan(0);
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
  expect(world.boss()?.title).toBe("吞噬者");
  run(world, 6000);
  const boss = world.boss();
  expect(boss?.hitsRemaining ?? 0).toBeLessThan(boss?.maxHits ?? 0);
  run(world, 20000);
  expect(world.boss()).toBeUndefined();
  expect(world.bossesSlain()).toBe(1);
});

test("archiving a change summons the night boss and returns to patrol", async () => {
  const world = createWorld();
  world.setMode(openspec("night"));
  world.setMode({ kind: "free" });
  expect(world.boss()?.title).toBe("深淵獸");
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
  expect(world.log().some((line) => line === "擊倒觸手怪（Bash）")).toBe(true);
  expect(world.summary().startsWith("迎戰")).toBe(false);
  world.setMode(openspec("dawn"));
  world.setMode(openspec("noon"));
  run(world, 3000);
  expect(world.summary().startsWith("BOSS 戰：吞噬者")).toBe(true);
});
