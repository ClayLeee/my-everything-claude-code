import { clearBitmap, createBitmap } from "../shared/pixel/bitmap";
import type { Bitmap } from "../shared/pixel/bitmap";
import { BOSS_TITLES } from "../art/boss";
import { MONSTER_NAMES } from "../art/monsters";
import { EFFECT_LIFE_MS } from "../draw/effects";
import { boardLeft, drawScene, isPresenting, muzzleOf, partyLayout } from "../draw/scene";
import { blendSky, skyFor } from "../draw/sky";
import type { SkyStyle } from "../draw/sky";
import { DOC_COUNT, phaseRank } from "../openspec";
import { flexPose, liftPose, partyPose, sleepPose } from "./routines";
import {
  AIM_MS,
  BAG_MS,
  BEAM_MS,
  BOSS_ATTACK_MS,
  BOSS_DEATH_MS,
  BOSS_FIRE_INTERVAL_MS,
  BOSS_HIT_STOP_MS,
  BOSS_HITS,
  BOSS_MAX_HITS,
  BOSS_MIN_HITS,
  BOSS_SPEED_PIXELS_PER_SECOND,
  BOSS_STAND_OFFSET,
  CHEER_MS,
  COMBO_MS,
  COMET_DROP,
  COOLDOWN_MS,
  DEATH_MS,
  FLASH_MS,
  floorOf,
  FLYER_MAX_MS,
  FLYER_MIN_MS,
  FLYER_SPEEDS,
  HEAT_MS,
  HIT_STOP_MS,
  HOME_X,
  HURT_SHAKE_MS,
  IDLE_MAX_MS,
  IDLE_MIN_MS,
  IMPACT_PROGRESS,
  KNOCKBACK_MS,
  KNOCKBACK_PIXELS,
  LOG_LIMIT,
  LONG_CALL_MS,
  MAX_ALIVE_MONSTERS,
  MAX_COLUMNS,
  MONSTER_FRONT_X,
  MONSTER_GAP,
  MONSTER_SPEED_PIXELS_PER_SECOND,
  ORB_SPEED_PIXELS_PER_SECOND,
  PHASE_BLEND_MS,
  RAGE_MS,
  SHAKE_MS,
  STAGE_ROWS,
  STATS_MS,
  WAKE_MS,
} from "./constants";
import type {
  Alien,
  AlienMode,
  Boss,
  Effect,
  Flyer,
  FlyerKind,
  IdleActivity,
  Mode,
  Monster,
  MonsterKind,
  Orb,
  Phase,
  Tally,
} from "./types";

const KINDS: readonly [MonsterKind, ...MonsterKind[]] = ["slime", "eyeworm", "moth", "squid"];
const ACTIVITIES: readonly [IdleActivity, ...IdleActivity[]] = ["sleep", "workout", "flex"];
const MONSTER_WIDTH = 13;
const READY_LINGER_MS = 2500;

const PHASE_LABELS: Record<Phase, string> = {
  dawn: "黎明・寫文件",
  noon: "正午・實作中",
  dusk: "黃昏・驗證中",
  night: "入夜・待 archive",
};

const IDLE_ACTIONS: Record<IdleActivity, string> = {
  sleep: "睡覺中",
  workout: "舉槓鈴中",
  flex: "秀肌肉中",
};

const ACTIVITY_LINES: Record<IdleActivity, string> = {
  sleep: "鑽進睡袋呼呼大睡",
  workout: "開始舉槓鈴",
  flex: "對著星空秀肌肉",
};

function seeded(seed: number): () => number {
  let state = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0 || 7;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function emptyTally(): Tally {
  return { slime: 0, eyeworm: 0, moth: 0, squid: 0 };
}

// A bigger change ends with a tougher boss: half its task count, within bounds.
export function bossHitsFor(mode: Mode): number {
  if (mode.kind !== "openspec" || mode.total === 0) return BOSS_HITS;
  return Math.min(BOSS_MAX_HITS, Math.max(BOSS_MIN_HITS, Math.round(mode.total / 2)));
}

// Reading and searching brings eye worms, writing brings slimes, running commands brings
// squids, and work handed elsewhere (agents, skills, other MCP tools) brings moths. Matched
// on whole words of the tool's own name (the last `__` segment of an MCP tool, split at
// camel case, `_` and `-`), so `set_target` holds no "get"; first match wins.
const TOOL_KINDS: readonly (readonly [MonsterKind, ReadonlySet<string>])[] = [
  ["eyeworm", new Set(["read", "grep", "glob", "search", "find", "tree", "list", "fetch", "query", "view", "get"])],
  ["slime", new Set(["edit", "write", "patch", "create", "update", "delete", "rename", "notebook"])],
  ["moth", new Set(["agent", "task", "skill", "workflow", "send"])],
  ["squid", new Set(["bash", "shell", "exec", "run", "kill", "command"])],
];

function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/);
}

// A tool's own name: an MCP tool's last `__` segment, so the log stays short.
export function toolName(tool: string): string {
  return tool.split("__").pop() || tool;
}

// Which creature a tool call brings, so the scene shows at a glance what Claude is doing.
// Tools that match nothing take turns by id.
export function kindFor(tool: string, id: number): MonsterKind {
  const words = wordsOf(toolName(tool));
  const match = TOOL_KINDS.find(([, names]) => words.some((word) => names.has(word)));
  if (match) return match[0];
  if (tool.startsWith("mcp__")) return "moth";
  return KINDS[(id - 1) % KINDS.length] ?? KINDS[0];
}

export function createWorld(options: { seed?: number } = {}) {
  const random = seeded(options.seed ?? 23);
  let columns = MAX_COLUMNS;
  let height = STAGE_ROWS * 2;
  let floor = floorOf(height);
  let bitmap = createBitmap({ width: columns, height });
  let monsters: Monster[] = [];
  let effects: Effect[] = [];
  let boss: Boss | undefined;
  const pendingBosses: { title: string; hits: number }[] = [];
  let bossCooldownMs = 0;
  let bossAttackMs = 0;
  let orbs: Orb[] = [];
  let freezeMs = 0;
  let killsAtCelebrate = 0;
  let flyers: Flyer[] = [];
  let flyerMs = FLYER_MIN_MS / 2;
  let shakeMs = 0;
  let nextId = 1;
  let readyIdleMs = 0;
  // The idle routine's last keyframe, so effects fire once as a new one starts.
  let idleBeat = "";
  // Likewise for the stats party.
  let partyBeat = "";
  let mode: Mode = { kind: "free" };
  let hasMode = false;
  let sky: SkyStyle = skyFor(mode);
  let skyFrom: SkyStyle = sky;
  let blendMs = PHASE_BLEND_MS;
  let tally: Tally = emptyTally();
  let slain = 0;
  let bossesSlain = 0;
  let combo = 0;
  let lastKillMs = -Infinity;
  let lines: string[] = ["外星人鑽進睡袋呼呼大睡"];
  const overflow = new Map<number, { kind: MonsterKind; tool: string }>();

  const alien: Alien = {
    mode: "idle",
    modeMs: 0,
    clockMs: 0,
    activity: "sleep",
    activityMs: 0,
    activityLengthMs: IDLE_MIN_MS,
    targetX: 0,
    hasStruck: false,
    isCheerRequested: false,
    heatMs: 0,
    hurtMs: 0,
    bagMs: 0,
    statsMs: 0,
    askMs: 0,
  };
  // Questions put to the person still open (AskUserQuestion, ExitPlanMode).
  let asking = 0;

  function note(line: string): void {
    lines = [line, ...lines].slice(0, LOG_LIMIT);
  }

  function enter(next: AlienMode): void {
    alien.mode = next;
    alien.modeMs = 0;
  }

  function nextActivity(): void {
    const choices = ACTIVITIES.filter((activity) => activity !== alien.activity);
    alien.activity = choices[Math.floor(random() * choices.length)] ?? ACTIVITIES[0];
    alien.activityMs = 0;
    alien.activityLengthMs = IDLE_MIN_MS + random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    idleBeat = "";
    note(`外星人${ACTIVITY_LINES[alien.activity]}`);
  }

  function bossStandX(): number {
    return Math.max(32, columns - BOSS_STAND_OFFSET);
  }

  function summonBoss(title: string, hits: number): void {
    // A dying boss still plays out its death before the next one steps in.
    if (boss) {
      pendingBosses.push({ title, hits });
      return;
    }
    boss = {
      x: columns,
      hitsRemaining: hits,
      maxHits: hits,
      phase: "enter",
      phaseMs: 0,
      flashMs: 0,
      walkMs: 0,
      title,
    };
    bossCooldownMs = 0;
    bossAttackMs = 0;
    note(`⚠ BOSS「${title}」降臨`);
  }

  // Kills within COMBO_MS of the last chain into a combo, shown from the second on.
  function recordKill(kind: MonsterKind, tool: string, x: number): void {
    tally = { ...tally, [kind]: tally[kind] + 1 };
    slain += 1;
    combo = alien.clockMs - lastKillMs <= COMBO_MS ? combo + 1 : 1;
    lastKillMs = alien.clockMs;
    if (combo < 2) {
      note(`擊倒${MONSTER_NAMES[kind]}（${tool}）`);
      return;
    }
    note(`擊倒${MONSTER_NAMES[kind]}（${tool}）· ${combo} 連擊`);
    const width = 4 + String(combo).length * 4;
    effects.push({
      kind: "combo",
      x: Math.min(x, columns - width),
      y: Math.max(0, floor - 14),
      ageMs: 0,
      value: combo,
    });
  }

  function aliveMonsters(): Monster[] {
    return monsters.filter((monster) => monster.phase === "alive");
  }

  function action(): string {
    if (alien.statsMs > 0) return `戰績：擊倒 ${slain} 隻 · BOSS ${bossesSlain}`;
    if (asking > 0) return `等你回覆中 · ${Math.floor(alien.askMs / 1000)} 秒`;
    if (boss && boss.phase !== "dying")
      return `BOSS 戰：${boss.title} HP ${boss.hitsRemaining}/${boss.maxHits}`;
    const living = aliveMonsters();
    const alive = living.length + overflow.size;
    const [longest] = living
      .filter((monster) => !monster.isDoomed && monster.waitMs >= LONG_CALL_MS)
      .sort((first, second) => second.waitMs - first.waitMs);
    if (longest)
      return `迎戰 ${alive} 隻異形 · ${longest.tool} 已等 ${Math.floor(longest.waitMs / 1000)} 秒`;
    if (alive > 0) return `迎戰 ${alive} 隻異形`;
    if (alien.mode === "cheer") return "慶祝勝利";
    if (alien.mode === "idle") return IDLE_ACTIONS[alien.activity];
    return "警戒中";
  }

  function retarget(): { kind: "monster"; monster: Monster } | { kind: "boss" } | undefined {
    const [nearest] = monsters
      .filter((monster) => monster.phase === "alive" && monster.isDoomed)
      .sort((first, second) => first.x - second.x);
    if (nearest) return { kind: "monster", monster: nearest };
    if (boss && boss.phase === "fight" && bossCooldownMs >= BOSS_FIRE_INTERVAL_MS)
      return { kind: "boss" };
    return undefined;
  }

  function impact(): void {
    const target = retarget();
    if (!target) return;
    const y = muzzleOf(floor).y;
    if (target.kind === "boss" && boss) {
      boss.hitsRemaining -= 1;
      boss.flashMs = FLASH_MS;
      bossCooldownMs = 0;
      freezeMs = BOSS_HIT_STOP_MS;
      effects.push(
        { kind: "hit", x: boss.x + 3, y, ageMs: 0 },
        { kind: "debris", x: boss.x + 3, y, ageMs: 0, direction: -1 },
      );
      if (boss.hitsRemaining <= 0) {
        boss.phase = "dying";
        boss.phaseMs = 0;
        bossesSlain += 1;
        shakeMs = SHAKE_MS;
        orbs = [];
        effects.push({ kind: "blast", x: boss.x + 10, y: floor - 8, ageMs: 0 });
        note(`★ 擊敗 BOSS「${boss.title}」`);
        alien.isCheerRequested = true;
      }
      return;
    }
    if (target.kind !== "monster") return;
    const monster = target.monster;
    monster.hitsRemaining -= 1;
    monster.flashMs = FLASH_MS;
    freezeMs = HIT_STOP_MS;
    effects.push(
      { kind: "hit", x: monster.x + 2, y, ageMs: 0 },
      { kind: "debris", x: monster.x + 2, y, ageMs: 0, direction: 1 },
    );
    if (monster.hitsRemaining <= 0) {
      monster.phase = "dying";
      monster.phaseMs = 0;
      recordKill(monster.kind, monster.tool, monster.x + 2);
      return;
    }
    monster.knockMs = KNOCKBACK_MS;
  }

  function hasThreat(): boolean {
    return (
      aliveMonsters().length > 0 ||
      overflow.size > 0 ||
      (boss !== undefined && boss.phase !== "dying")
    );
  }

  function sweat(isLeft: boolean, y: number): void {
    effects.push({
      kind: "sweat",
      x: HOME_X + (isLeft ? 4 : 11),
      y,
      ageMs: 0,
      direction: isLeft ? -1 : 1,
    });
  }

  // Effects land on keyframe edges of the shared routine timelines.
  function idleEffects(): void {
    if (alien.activity === "sleep") {
      const pose = sleepPose(alien.activityMs);
      const beat = `${pose.breath}:${pose.isExhaling}`;
      if (beat !== idleBeat && pose.isExhaling)
        effects.push({ kind: "zee", x: HOME_X + 4, y: floor - 10, ageMs: 0 });
      idleBeat = beat;
      return;
    }
    if (alien.activity === "workout") {
      const pose = liftPose(alien.activityMs);
      const beat = `${pose.rep}:${pose.phase}`;
      if (beat !== idleBeat && pose.phase === "bounce") sweat(pose.rep % 2 === 0, floor - 10);
      if (beat !== idleBeat && pose.phase === "rest") {
        sweat(true, floor - 9);
        sweat(false, floor - 9);
      }
      idleBeat = beat;
      return;
    }
    const pose = flexPose(alien.activityMs);
    const beat = `${pose.pose}:${pose.phase}`;
    if (beat !== idleBeat && pose.phase === "hit") {
      const spots =
        pose.shot === "front" ? [HOME_X - 1, HOME_X + 14] : [HOME_X + (pose.shot === "right" ? 12 : 1)];
      spots.forEach((x) => effects.push({ kind: "sparkle", x, y: floor - 11, ageMs: 0 }));
    }
    idleBeat = beat;
  }

  // A spark where the hands meet on each high-five, and two fireworks over the alien at the finale.
  function partyEffects(): void {
    if (!isPresenting(alien)) return;
    const pose = partyPose(STATS_MS - alien.statsMs);
    const layout = partyLayout(floor);
    const slap = pose.isSlap ? `slap:${pose.entry}` : "";
    const finale = pose.isFinale ? "finale" : "";
    if (slap && !partyBeat.includes(slap)) effects.push({ kind: "sparkle", ...layout.slap, ageMs: 0 });
    // Only where there is sky over the alien to burst in (the short pane has none), left of the
    // UFO and clear of the board by a firework's reach.
    if (finale && !partyBeat.includes(finale) && layout.hoverY >= 0) {
      const reach = 7;
      [
        { x: layout.ufoX - 4, y: layout.hoverY },
        { x: layout.ufoX - 10, y: layout.hoverY - 2 },
      ]
        .filter((spot) => spot.x + reach < boardLeft(columns))
        .forEach((spot) => effects.push({ kind: "firework", ...spot, ageMs: 0 }));
    }
    partyBeat = `${slap} ${finale}`;
  }

  function advanceAlien(dtMs: number): void {
    alien.clockMs += dtMs;
    alien.modeMs += dtMs;
    alien.heatMs = Math.max(0, alien.heatMs - dtMs);
    alien.hurtMs = Math.max(0, alien.hurtMs - dtMs);
    alien.bagMs = Math.max(0, alien.bagMs - dtMs);
    alien.statsMs = Math.max(0, alien.statsMs - dtMs);
    partyEffects();
    alien.askMs = asking > 0 ? alien.askMs + dtMs : 0;
    const target = retarget();
    if (alien.mode === "idle") {
      // A question for the person gets the alien up to wait on the answer.
      if (asking > 0) {
        if (alien.activity === "sleep") alien.bagMs = BAG_MS;
        effects = effects.filter((effect) => effect.kind !== "zee");
        enter("wake");
        return;
      }
      if (hasThreat()) {
        if (alien.activity === "sleep") alien.bagMs = BAG_MS;
        effects = effects.filter((effect) => effect.kind !== "zee");
        const onlyBoss =
          boss !== undefined && !monsters.some((monster) => monster.phase === "alive");
        note(onlyBoss ? "BOSS 來襲，外星人起身迎戰" : "異形來襲，外星人起身迎戰");
        enter("wake");
        return;
      }
      if (alien.isCheerRequested) {
        alien.isCheerRequested = false;
        enter("cheer");
        return;
      }
      // Showing off the stats board holds the idle routine.
      if (alien.statsMs > 0) return;
      alien.activityMs += dtMs;
      idleEffects();
      if (alien.activityMs >= alien.activityLengthMs) nextActivity();
      return;
    }
    if (alien.mode === "wake") {
      if (alien.modeMs >= WAKE_MS) enter("ready");
      return;
    }
    if (alien.mode === "ready" || alien.mode === "cheer") {
      if (target) {
        alien.targetX =
          target.kind === "boss" && boss
            ? boss.x + 3
            : target.kind === "monster"
              ? target.monster.x + 2
              : columns;
        enter("aim");
        return;
      }
      if (alien.mode === "cheer") {
        if (alien.modeMs >= CHEER_MS) enter("ready");
        return;
      }
      if (alien.isCheerRequested) {
        alien.isCheerRequested = false;
        enter("cheer");
        return;
      }
      readyIdleMs = hasThreat() || asking > 0 ? 0 : readyIdleMs + dtMs;
      if (readyIdleMs >= READY_LINGER_MS) {
        readyIdleMs = 0;
        enter("idle");
        nextActivity();
      }
      return;
    }
    if (alien.mode === "aim") {
      if (!target) {
        enter("ready");
        return;
      }
      if (alien.modeMs >= AIM_MS) {
        alien.hasStruck = false;
        const muzzle = muzzleOf(floor);
        effects.push({ kind: "muzzle", x: muzzle.x, y: muzzle.y, ageMs: 0 });
        enter("fire");
      }
      return;
    }
    if (alien.mode === "fire") {
      if (!alien.hasStruck && alien.modeMs >= BEAM_MS * IMPACT_PROGRESS) {
        alien.hasStruck = true;
        impact();
      }
      if (alien.modeMs >= BEAM_MS) {
        const muzzle = muzzleOf(floor);
        alien.heatMs = HEAT_MS;
        effects.push({ kind: "smoke", x: muzzle.x - 1, y: muzzle.y - 1, ageMs: 0 });
        enter("cooldown");
      }
      return;
    }
    if (alien.mode === "cooldown" && alien.modeMs >= COOLDOWN_MS) enter("ready");
  }

  function makeMonster(id: number, kind: MonsterKind, tool: string): Monster {
    return {
      id,
      kind,
      tool,
      label: MONSTER_NAMES[kind],
      x: columns,
      hitsRemaining: 1,
      isDoomed: false,
      phase: "alive",
      phaseMs: 0,
      flashMs: 0,
      walkMs: id * 137,
      waitMs: 0,
      rageMs: 0,
      knockMs: 0,
    };
  }

  // A creature steps out of a portal at the right edge.
  function arrive(id: number, kind: MonsterKind, tool: string): void {
    monsters.push(makeMonster(id, kind, tool));
    effects.push({ kind: "portal", x: columns - 3, y: floor - 6, ageMs: 0 });
  }

  function advanceMonsters(dtMs: number): void {
    const living = aliveMonsters().sort((first, second) => first.x - second.x);
    living.forEach((monster, rank) => {
      const limit = MONSTER_FRONT_X + rank * (MONSTER_WIDTH + MONSTER_GAP);
      if (monster.knockMs > 0) {
        // Ease out: speed falls linearly to zero over KNOCKBACK_MS; taking it at the middle
        // of each step makes the steps add up to exactly KNOCKBACK_PIXELS.
        const step = Math.min(dtMs, monster.knockMs);
        const middle = monster.knockMs - step / 2;
        monster.x += (KNOCKBACK_PIXELS * 2 * middle * step) / (KNOCKBACK_MS * KNOCKBACK_MS);
        monster.knockMs -= step;
      } else {
        monster.x = Math.max(limit, monster.x - (MONSTER_SPEED_PIXELS_PER_SECOND * dtMs) / 1000);
      }
      monster.walkMs += dtMs;
      if (!monster.isDoomed) monster.waitMs += dtMs;
      monster.flashMs = Math.max(0, monster.flashMs - dtMs);
      monster.rageMs = Math.max(0, monster.rageMs - dtMs);
    });
    monsters = monsters.filter((monster) => {
      if (monster.phase === "alive") return true;
      monster.phaseMs += dtMs;
      return monster.phaseMs < DEATH_MS;
    });
    const room = MAX_ALIVE_MONSTERS - living.length;
    [...overflow.entries()].slice(0, Math.max(0, room)).forEach(([id, waiting]) => {
      overflow.delete(id);
      arrive(id, waiting.kind, waiting.tool);
    });
  }

  function advanceBoss(dtMs: number): void {
    if (!boss) {
      const pending = pendingBosses.shift();
      if (pending) summonBoss(pending.title, pending.hits);
      return;
    }
    boss.phaseMs += dtMs;
    boss.walkMs += dtMs;
    boss.flashMs = Math.max(0, boss.flashMs - dtMs);
    if (boss.phase === "enter") {
      boss.x = Math.max(bossStandX(), boss.x - (BOSS_SPEED_PIXELS_PER_SECOND * dtMs) / 1000);
      if (boss.x <= bossStandX()) {
        boss.phase = "fight";
        boss.phaseMs = 0;
      }
    } else if (boss.phase === "fight") {
      bossCooldownMs += dtMs;
      bossAttackMs += dtMs;
      if (bossAttackMs >= BOSS_ATTACK_MS) {
        bossAttackMs = 0;
        const y = floor - 7;
        orbs.push({ x: boss.x - 2, y, ageMs: 0 });
        effects.push({ kind: "muzzle", x: boss.x, y, ageMs: 0 });
      }
    } else if (boss.phaseMs >= BOSS_DEATH_MS) {
      boss = undefined;
    }
  }

  // Boss orbs drift at the alien's head and burst on it.
  function advanceOrbs(dtMs: number): void {
    orbs = orbs.filter((orb) => {
      orb.ageMs += dtMs;
      orb.x -= (ORB_SPEED_PIXELS_PER_SECOND * dtMs) / 1000;
      if (orb.x > HOME_X + 11) return true;
      alien.hurtMs = RAGE_MS;
      shakeMs = Math.max(shakeMs, HURT_SHAKE_MS);
      effects.push({ kind: "splash", x: orb.x, y: orb.y, ageMs: 0 });
      return false;
    });
  }

  // In free mode something now and then crosses the night sky, high above the ridge.
  function advanceFlyers(dtMs: number): void {
    flyers = flyers.filter((flyer) => {
      flyer.ageMs += dtMs;
      const step = (FLYER_SPEEDS[flyer.kind] * dtMs) / 1000;
      flyer.x += flyer.direction * step;
      if (flyer.kind === "comet") flyer.y += step * COMET_DROP;
      return flyer.x > -16 && flyer.x < columns + 16;
    });
    if (mode.kind !== "free") return;
    flyerMs -= dtMs;
    if (flyerMs > 0) return;
    flyerMs = FLYER_MIN_MS + random() * (FLYER_MAX_MS - FLYER_MIN_MS);
    const roll = random();
    const kind: FlyerKind = roll < 0.5 ? "ufo" : roll < 0.85 ? "comet" : "satellite";
    const direction = random() < 0.5 ? 1 : -1;
    // A comet falls as it goes, so it starts at the top; in the tall pane the others pass
    // below the planet and above the ridge.
    const lane = floor - 15;
    const y =
      kind === "comet" || lane < 5 ? 1 + Math.floor(random() * 2) : lane + Math.floor(random() * 3);
    flyers.push({
      kind,
      x: direction === 1 ? -12 : columns + 4,
      y,
      direction,
      ageMs: 0,
    });
  }

  function currentSky(): SkyStyle {
    return blendSky(skyFrom, sky, blendMs / PHASE_BLEND_MS);
  }

  function shake(): void {
    if (shakeMs <= 0) return;
    const { pixels, width } = bitmap;
    const isLeft = Math.floor(shakeMs / 40) % 2 === 0;
    // Shift each row one pixel in place; the edge pixel repeats.
    for (let row = 0; row < pixels.length; row += width) {
      if (isLeft) {
        for (let x = 0; x < width - 1; x += 1) pixels[row + x] = pixels[row + x + 1] ?? null;
      } else {
        for (let x = width - 1; x > 0; x -= 1) pixels[row + x] = pixels[row + x - 1] ?? null;
      }
    }
  }

  return {
    resize(nextColumns: number, rows: number = STAGE_ROWS): void {
      if (nextColumns === columns && rows * 2 === height) return;
      columns = nextColumns;
      height = rows * 2;
      floor = floorOf(height);
      bitmap = createBitmap({ width: columns, height });
    },

    // Kills count for this session only: cleared on session start and by `/alien reset`.
    resetCounts(): void {
      tally = emptyTally();
      slain = 0;
      bossesSlain = 0;
      killsAtCelebrate = 0;
    },

    // `/alien stats`: the alien shows off a board that counts up the kills.
    showStats(): void {
      alien.statsMs = STATS_MS;
      partyBeat = "";
      effects = effects.filter((effect) => effect.kind !== "zee");
    },

    slain: (): number => slain,
    bossesSlain: (): number => bossesSlain,
    tally: (): Tally => tally,
    log: (): readonly string[] => lines,
    mode: (): Mode => mode,
    alien: (): Alien => alien,
    boss: (): Boss | undefined => boss,
    monsters: (): readonly Monster[] => monsters,
    orbs: (): readonly Orb[] => orbs,
    flyers: (): readonly Flyer[] => flyers,
    effects: (): readonly Effect[] => effects,

    setMode(next: Mode): void {
      const previous = mode;
      mode = next;
      if (!hasMode) {
        hasMode = true;
        sky = skyFor(next);
        skyFrom = sky;
        blendMs = PHASE_BLEND_MS;
        return;
      }
      const isSameStage =
        previous.kind === next.kind &&
        (previous.kind === "free" ||
          (next.kind === "openspec" &&
            previous.change === next.change &&
            previous.phase === next.phase));
      if (isSameStage) return;
      skyFrom = currentSky();
      sky = skyFor(next);
      blendMs = 0;
      if (previous.kind !== "openspec") {
        if (next.kind === "openspec") note(`新的一天：change「${next.change}」開始`);
        return;
      }
      const advanced =
        next.kind === "openspec" &&
        next.change === previous.change &&
        phaseRank(next.phase) > phaseRank(previous.phase);
      const finished = next.kind === "free" || next.change !== previous.change;
      if (advanced || finished) summonBoss(BOSS_TITLES[previous.phase], bossHitsFor(previous));
      if (next.kind === "free") note(`change「${previous.change}」已 archive，回到夜間巡邏`);
    },

    spawn(tool: string = "工具"): number {
      const id = nextId;
      nextId += 1;
      const kind = kindFor(tool, id);
      const name = toolName(tool);
      if (aliveMonsters().length >= MAX_ALIVE_MONSTERS) {
        overflow.set(id, { kind, tool: name });
        return id;
      }
      arrive(id, kind, name);
      return id;
    },

    defeat(outcome: { id: number; isFailure: boolean }): void {
      const monster = monsters.find((candidate) => candidate.id === outcome.id);
      if (monster) {
        monster.isDoomed = true;
        monster.hitsRemaining = 1 + (outcome.isFailure ? 1 : 0);
        if (outcome.isFailure) {
          monster.rageMs = RAGE_MS;
          alien.hurtMs = RAGE_MS;
          shakeMs = Math.max(shakeMs, HURT_SHAKE_MS);
          note(`工具失敗：${monster.label}擋下了一發雷射`);
        }
        return;
      }
      const waiting = overflow.get(outcome.id);
      if (waiting) {
        // It never reached the field: a far-off flash past the right edge stands for the kill.
        overflow.delete(outcome.id);
        const x = columns - 4 - Math.floor(random() * 6);
        effects.push({ kind: "distant", x, y: floor - 6 - Math.floor(random() * 3), ageMs: 0 });
        recordKill(waiting.kind, waiting.tool, x);
      }
    },

    // Claude puts a question to the person, and later has the answer.
    ask(): void {
      if (asking === 0) note("外星人轉頭等你回覆");
      asking += 1;
    },

    answer(): void {
      asking = Math.max(0, asking - 1);
    },

    // Cheers a turn only when it brought kills.
    celebrate(): void {
      const kills = slain + bossesSlain;
      if (kills > killsAtCelebrate) alien.isCheerRequested = true;
      killsAtCelebrate = kills;
    },

    tick(dtMs: number): void {
      // Hit stop: the whole scene holds for a beat when a shot lands.
      if (freezeMs > 0) {
        freezeMs = Math.max(0, freezeMs - dtMs);
        return;
      }
      blendMs = Math.min(PHASE_BLEND_MS, blendMs + dtMs);
      shakeMs = Math.max(0, shakeMs - dtMs);
      advanceBoss(dtMs);
      advanceAlien(dtMs);
      // A shot that just landed holds the rest of this tick too, so the target stops before
      // it is thrown back.
      if (freezeMs > 0) return;
      advanceMonsters(dtMs);
      advanceOrbs(dtMs);
      advanceFlyers(dtMs);
      effects.forEach((effect) => {
        effect.ageMs += dtMs;
      });
      effects = effects.filter((effect) => effect.ageMs < EFFECT_LIFE_MS[effect.kind]);
    },

    action,

    summary(): string {
      if (mode.kind === "free")
        return `${action()} · 夜間巡邏 · 擊倒 ${slain}`;
      const progress =
        mode.phase === "dawn" ? `文件 ${mode.docs}/${DOC_COUNT}` : `任務 ${mode.done}/${mode.total}`;
      const others = mode.others > 0 ? ` · 另有 ${mode.others} 個 change` : "";
      return `${action()} · ${mode.change} · ${PHASE_LABELS[mode.phase]} ${progress} · 擊倒 ${slain}${others}`;
    },

    frame(): Bitmap {
      clearBitmap(bitmap);
      drawScene({
        bitmap,
        floor,
        sky: currentSky(),
        mode,
        alien,
        monsters,
        boss,
        orbs,
        flyers,
        effects,
        stats: { tally, slain, bosses: bossesSlain },
      });
      shake();
      return bitmap;
    },
  };
}

export type World = ReturnType<typeof createWorld>;
