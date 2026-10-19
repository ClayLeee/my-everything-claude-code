export const FRAME_MS = 40;
export const STAGE_ROWS = 8;
export const TALL_ROWS = 14;
export const MIN_COLUMNS = 44;
export const MAX_COLUMNS = 72;

export const HOME_X = 2;
export const ALIEN_HEIGHT = 14;

export const AIM_MS = 90;
export const BEAM_MS = 240;
export const IMPACT_PROGRESS = 0.55;
export const COOLDOWN_MS = 160;
export const HEAT_MS = 900;
export const CHEER_MS = 1400;
export const WAKE_MS = 420;
export const BAG_MS = 1500;
export const HIT_STOP_MS = 60;
export const BOSS_HIT_STOP_MS = 90;

export const MONSTER_FRONT_X = 30;
export const MONSTER_GAP = 3;
export const MONSTER_SPEED_PIXELS_PER_SECOND = 14;
export const KNOCKBACK_PIXELS = 4;
export const KNOCKBACK_MS = 160;
export const MAX_ALIVE_MONSTERS = 4;
export const DEATH_MS = 700;
export const FLASH_MS = 110;
export const WALK_FRAME_MS = 300;

export const LONG_CALL_MS = 10000;
export const RAGE_MS = 600;
export const HURT_SHAKE_MS = 250;

export const BOSS_HITS = 8;
export const BOSS_MIN_HITS = 4;
export const BOSS_MAX_HITS = 12;
export const BOSS_STAND_OFFSET = 24;
export const BOSS_SPEED_PIXELS_PER_SECOND = 10;
export const BOSS_FIRE_INTERVAL_MS = 1000;
export const BOSS_ATTACK_MS = 2600;
export const ORB_SPEED_PIXELS_PER_SECOND = 28;
export const BOSS_DEATH_MS = 1400;
export const SHAKE_MS = 700;

export const IDLE_MIN_MS = 9000;
export const IDLE_MAX_MS = 15000;
export const LIFT_CYCLE_MS = 1400;
export const FLEX_SIDE_MS = 1500;
export const FLEX_RELAX_MS = 500;
export const PHASE_BLEND_MS = 8000;
export const LOG_LIMIT = 8;

export function floorOf(height: number): number {
  return height - (height > 16 ? 4 : 2);
}
