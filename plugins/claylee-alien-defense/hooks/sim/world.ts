import { clearBitmap, createBitmap } from "../shared/pixel/bitmap";
import type { Bitmap } from "../shared/pixel/bitmap";
import { BOSS_TITLES } from "../art/boss";
import { MONSTER_NAMES } from "../art/monsters";
import { EFFECT_LIFE_MS } from "../draw/effects";
import { drawScene, muzzleOf } from "../draw/scene";
import { blendSky, skyFor } from "../draw/sky";
import type { SkyStyle } from "../draw/sky";
import { phaseRank } from "../openspec";
import {
  AIM_MS,
  BEAM_MS,
  BOSS_DEATH_MS,
  BOSS_FIRE_INTERVAL_MS,
  BOSS_HITS,
  BOSS_SPEED_PIXELS_PER_SECOND,
  BOSS_STAND_OFFSET,
  CHEER_MS,
  COOLDOWN_MS,
  DEATH_MS,
  FLASH_MS,
  floorOf,
  HOME_X,
  IDLE_MAX_MS,
  IDLE_MIN_MS,
  IMPACT_PROGRESS,
  KNOCKBACK_PIXELS,
  LIFT_CYCLE_MS,
  LOG_LIMIT,
  MAX_ALIVE_MONSTERS,
  MAX_COLUMNS,
  MONSTER_FRONT_X,
  MONSTER_GAP,
  MONSTER_SPEED_PIXELS_PER_SECOND,
  PHASE_BLEND_MS,
  SHAKE_MS,
  STAGE_ROWS,
  WAKE_MS,
} from "./constants";
import type {
  Alien,
  AlienMode,
  Boss,
  Effect,
  IdleActivity,
  Mode,
  Monster,
  MonsterKind,
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

export function createWorld(options: { seed?: number } = {}) {
  const random = seeded(options.seed ?? 23);
  let columns = MAX_COLUMNS;
  let height = STAGE_ROWS * 2;
  let floor = floorOf(height);
  let bitmap = createBitmap({ width: columns, height });
  let monsters: Monster[] = [];
  let effects: Effect[] = [];
  let boss: Boss | undefined;
  const pendingBosses: string[] = [];
  let bossCooldownMs = 0;
  let shakeMs = 0;
  let nextId = 1;
  let readyIdleMs = 0;
  let idleBeatMs = 0;
  let wasLiftUp = false;
  let mode: Mode = { kind: "free" };
  let hasMode = false;
  let sky: SkyStyle = skyFor(mode);
  let skyFrom: SkyStyle = sky;
  let blendMs = PHASE_BLEND_MS;
  let tally: Tally = emptyTally();
  let lifetime = 0;
  let slain = 0;
  let bossesSlain = 0;
  let lines: string[] = [];
  const overflow = new Map<number, MonsterKind>();

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
  };

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
    idleBeatMs = 0;
    note(`外星人${ACTIVITY_LINES[alien.activity]}`);
  }

  function bossStandX(): number {
    return Math.max(32, columns - BOSS_STAND_OFFSET);
  }

  function summonBoss(title: string): void {
    if (boss && boss.phase !== "dying") {
      pendingBosses.push(title);
      return;
    }
    boss = {
      x: columns,
      hitsRemaining: BOSS_HITS,
      phase: "enter",
      phaseMs: 0,
      flashMs: 0,
      walkMs: 0,
      title,
    };
    bossCooldownMs = 0;
    note(`⚠ BOSS「${title}」降臨`);
  }

  function recordKill(kind: MonsterKind): void {
    tally = { ...tally, [kind]: tally[kind] + 1 };
    slain += 1;
    lifetime += 1;
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
      effects.push(
        { kind: "hit", x: boss.x + 3, y, ageMs: 0 },
        { kind: "debris", x: boss.x + 3, y, ageMs: 0, direction: -1 },
      );
      if (boss.hitsRemaining <= 0) {
        boss.phase = "dying";
        boss.phaseMs = 0;
        bossesSlain += 1;
        lifetime += 1;
        shakeMs = SHAKE_MS;
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
    effects.push(
      { kind: "hit", x: monster.x + 2, y, ageMs: 0 },
      { kind: "debris", x: monster.x + 2, y, ageMs: 0, direction: 1 },
    );
    if (monster.hitsRemaining <= 0) {
      monster.phase = "dying";
      monster.phaseMs = 0;
      recordKill(monster.kind);
      return;
    }
    monster.x += KNOCKBACK_PIXELS;
  }

  function hasThreat(): boolean {
    return (
      monsters.some((monster) => monster.phase === "alive") ||
      overflow.size > 0 ||
      (boss !== undefined && boss.phase !== "dying")
    );
  }

  function idleEffects(dtMs: number): void {
    idleBeatMs += dtMs;
    if (alien.activity === "sleep") {
      if (idleBeatMs >= 1200) {
        idleBeatMs = 0;
        effects.push({ kind: "zee", x: HOME_X + 4, y: floor - 10, ageMs: 0 });
      }
      if (!effects.some((effect) => effect.kind === "bubble"))
        effects.push({ kind: "bubble", x: HOME_X + 9, y: floor - 5, ageMs: 0 });
      return;
    }
    if (alien.activity === "workout") {
      const isUp = alien.activityMs % LIFT_CYCLE_MS >= LIFT_CYCLE_MS / 2;
      if (isUp && !wasLiftUp) {
        effects.push(
          { kind: "sweat", x: HOME_X + 4, y: floor - 10, ageMs: 0, direction: -1 },
          { kind: "sweat", x: HOME_X + 11, y: floor - 10, ageMs: 0, direction: 1 },
        );
      }
      wasLiftUp = isUp;
      return;
    }
    if (idleBeatMs >= 700) {
      idleBeatMs = 0;
      const side = Math.floor(alien.activityMs / 700) % 2 === 0;
      effects.push({ kind: "sparkle", x: HOME_X + (side ? 0 : 15), y: floor - 13, ageMs: 0 });
    }
  }

  function advanceAlien(dtMs: number): void {
    alien.clockMs += dtMs;
    alien.modeMs += dtMs;
    const target = retarget();
    if (alien.mode === "idle") {
      if (hasThreat()) {
        effects = effects.filter((effect) => effect.kind !== "bubble" && effect.kind !== "zee");
        enter("wake");
        return;
      }
      if (alien.isCheerRequested) {
        alien.isCheerRequested = false;
        enter("cheer");
        return;
      }
      alien.activityMs += dtMs;
      idleEffects(dtMs);
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
      readyIdleMs = hasThreat() ? 0 : readyIdleMs + dtMs;
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
      if (alien.modeMs >= BEAM_MS) enter("cooldown");
      return;
    }
    if (alien.mode === "cooldown" && alien.modeMs >= COOLDOWN_MS) enter("ready");
  }

  function makeMonster(id: number, kind: MonsterKind): Monster {
    return {
      id,
      kind,
      label: MONSTER_NAMES[kind],
      x: columns,
      hitsRemaining: 1,
      isDoomed: false,
      phase: "alive",
      phaseMs: 0,
      flashMs: 0,
      walkMs: id * 137,
    };
  }

  function advanceMonsters(dtMs: number): void {
    monsters
      .filter((monster) => monster.phase === "alive")
      .sort((first, second) => first.x - second.x)
      .forEach((monster, rank) => {
        const limit = MONSTER_FRONT_X + rank * (MONSTER_WIDTH + MONSTER_GAP);
        monster.x = Math.max(limit, monster.x - (MONSTER_SPEED_PIXELS_PER_SECOND * dtMs) / 1000);
        monster.walkMs += dtMs;
        monster.flashMs = Math.max(0, monster.flashMs - dtMs);
      });
    monsters
      .filter((monster) => monster.phase === "dying")
      .forEach((monster) => {
        monster.phaseMs += dtMs;
      });
    monsters = monsters.filter(
      (monster) => monster.phase === "alive" || monster.phaseMs < DEATH_MS,
    );
    const room =
      MAX_ALIVE_MONSTERS - monsters.filter((monster) => monster.phase === "alive").length;
    [...overflow.entries()].slice(0, Math.max(0, room)).forEach(([id, kind]) => {
      overflow.delete(id);
      monsters.push(makeMonster(id, kind));
    });
  }

  function advanceBoss(dtMs: number): void {
    if (!boss) {
      const title = pendingBosses.shift();
      if (title) summonBoss(title);
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
    } else if (boss.phaseMs >= BOSS_DEATH_MS) {
      boss = undefined;
    }
  }

  function currentSky(): SkyStyle {
    return blendSky(skyFrom, sky, blendMs / PHASE_BLEND_MS);
  }

  function shake(): void {
    if (shakeMs <= 0) return;
    const offset = Math.floor(shakeMs / 40) % 2 === 0 ? 1 : -1;
    const copy = [...bitmap.pixels];
    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        bitmap.pixels[y * bitmap.width + x] =
          copy[y * bitmap.width + Math.min(bitmap.width - 1, Math.max(0, x + offset))] ?? null;
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

    restore(saved: { lifetime: number }): void {
      lifetime = saved.lifetime;
    },

    lifetime: (): number => lifetime,
    slain: (): number => slain,
    bossesSlain: (): number => bossesSlain,
    tally: (): Tally => tally,
    log: (): readonly string[] => lines,
    mode: (): Mode => mode,
    alien: (): Alien => alien,
    boss: (): Boss | undefined => boss,
    monsters: (): readonly Monster[] => monsters,

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
      if (advanced || finished) summonBoss(BOSS_TITLES[previous.phase]);
      if (next.kind === "free") note(`change「${previous.change}」已 archive，回到夜間巡邏`);
    },

    spawn(): number {
      const id = nextId;
      nextId += 1;
      const kind = KINDS[(id - 1) % KINDS.length] ?? KINDS[0];
      if (monsters.filter((monster) => monster.phase === "alive").length >= MAX_ALIVE_MONSTERS) {
        overflow.set(id, kind);
        return id;
      }
      monsters.push(makeMonster(id, kind));
      return id;
    },

    defeat(outcome: { id: number; isFailure: boolean }): void {
      const monster = monsters.find((candidate) => candidate.id === outcome.id);
      if (monster) {
        monster.isDoomed = true;
        monster.hitsRemaining = 1 + (outcome.isFailure ? 1 : 0);
        if (outcome.isFailure) note(`工具失敗：${monster.label}擋下了一發雷射`);
        return;
      }
      const kind = overflow.get(outcome.id);
      if (kind) {
        overflow.delete(outcome.id);
        recordKill(kind);
      }
    },

    celebrate(): void {
      alien.isCheerRequested = true;
    },

    tick(dtMs: number): void {
      blendMs = Math.min(PHASE_BLEND_MS, blendMs + dtMs);
      shakeMs = Math.max(0, shakeMs - dtMs);
      advanceBoss(dtMs);
      advanceAlien(dtMs);
      advanceMonsters(dtMs);
      effects.forEach((effect) => {
        effect.ageMs += dtMs;
      });
      effects = effects.filter((effect) => effect.ageMs < EFFECT_LIFE_MS[effect.kind]);
    },

    summary(): string {
      const bossPart =
        boss && boss.phase !== "dying"
          ? `⚠ BOSS「${boss.title}」HP ${boss.hitsRemaining}/${BOSS_HITS} · `
          : "";
      if (mode.kind === "free") return `${bossPart}夜間巡邏 · 本次擊倒 ${slain} · 累計 ${lifetime}`;
      const progress =
        mode.phase === "dawn" ? `文件 ${mode.docs}/6` : `任務 ${mode.done}/${mode.total}`;
      return `${bossPart}${mode.change} · ${PHASE_LABELS[mode.phase]} ${progress} · 本次擊倒 ${slain}`;
    },

    frame(): Bitmap {
      clearBitmap(bitmap);
      drawScene({ bitmap, floor, sky: currentSky(), mode, alien, monsters, boss, effects });
      shake();
      return bitmap;
    },
  };
}

export type World = ReturnType<typeof createWorld>;
