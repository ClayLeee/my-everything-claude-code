import type { EngineInterface, Register } from "claude-code";

import { MONSTER_NAMES } from "./art/monsters";
import { readMode } from "./openspec";
import { configureStage, installStage } from "./shared/pixel/stage";
import { FRAME_MS, MAX_COLUMNS, MIN_COLUMNS, STAGE_ROWS, TALL_ROWS } from "./sim/constants";
import type { MonsterKind } from "./sim/types";
import { createWorld } from "./sim/world";

const LIFETIME_KEY = "lifetimeKills";
const POLL_MS = 3000;

async function projectRoot($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd();
  try {
    const ran = await $.process.run(["git", "rev-parse", "--show-toplevel"], { cwd });
    return ran.exitCode === 0 ? ran.stdout.trim() : cwd;
  } catch {
    return cwd;
  }
}

export const register: Register = (on) => {
  const world = createWorld();
  let isPolling = false;
  let isWatching = false;

  function report(): string[] {
    const tally = world.tally();
    const kinds = (Object.keys(tally) as MonsterKind[])
      .map((kind) => `${MONSTER_NAMES[kind]} ${tally[kind]}`)
      .join("，");
    return [
      world.summary(),
      `本次擊倒：${kinds}，BOSS ${world.bossesSlain()}`,
      `累計擊倒：${world.lifetime()}`,
    ];
  }

  configureStage({
    game: "alien-defense",
    title: "Alien",
    command: {
      name: "alien",
      description: "顯示或隱藏外星防衛畫面（on、off、stats）",
      report,
    },
    rows: STAGE_ROWS,
    tallRows: TALL_ROWS,
    minColumns: MIN_COLUMNS,
    maxColumns: MAX_COLUMNS,
    frameMs: FRAME_MS,
    scene: {
      begin: () => undefined,
      resize: (columns, rows) => world.resize(columns, rows),
      tick: (dtMs) => world.tick(dtMs),
      frame: () => world.frame(),
      summary: () => world.summary(),
      log: () => world.log(),
    },
  });
  installStage(on);

  on("session.start", async ($, e, next) => {
    world.restore({ lifetime: Number((await $.store.get(LIFETIME_KEY)) ?? 0) });
    const top = await projectRoot($);
    const poll = async (): Promise<void> => {
      if (isPolling) return;
      isPolling = true;
      try {
        world.setMode(await readMode($, top));
      } finally {
        isPolling = false;
      }
    };
    await poll();
    if (!isWatching) {
      isWatching = true;
      $.clock.every(POLL_MS, () => {
        void poll();
      });
    }
    return next(e);
  });

  on("tool.call", async ($, e, next) => {
    const id = world.spawn(e.tool);
    try {
      const ran = await next(e);
      world.defeat({ id, isFailure: ran.deny !== undefined || ran.isError === true });
      return ran;
    } catch (error) {
      world.defeat({ id, isFailure: true });
      throw error;
    }
  });

  on("turn.complete", async ($, e, next) => {
    world.celebrate();
    await $.store.set(LIFETIME_KEY, world.lifetime());
    return next(e);
  });

  on("session.end", async ($, e, next) => {
    await $.store.set(LIFETIME_KEY, world.lifetime());
    return next(e);
  });
};
