// Keyframe timelines for the idle routines and the UFO's visits. Pure functions of the elapsed
// time, shared by the world (which emits effects on phase edges) and the scene (which picks sprites).

import { STATS_ENTRY_MS, STATS_MS, STATS_TOTAL_MS } from "./constants";

export type LiftPhase = "rack" | "press" | "strain" | "bounce" | "lockout" | "lower" | "rest";

// One rep: dip with the bar on the shoulders, grind it up (slower and shakier near the top),
// lock out with a bar-bending bounce, then lower it faster than it went up.
const LIFT_KEYS: ReadonlyArray<{ phase: LiftPhase; ms: number }> = [
  { phase: "rack", ms: 450 },
  { phase: "press", ms: 350 },
  { phase: "strain", ms: 650 },
  { phase: "bounce", ms: 140 },
  { phase: "lockout", ms: 460 },
  { phase: "lower", ms: 380 },
  { phase: "rack", ms: 170 },
];
const REP_MS = LIFT_KEYS.reduce((sum, key) => sum + key.ms, 0);
// A set and its rest fit inside one idle activity (IDLE_MIN_MS..IDLE_MAX_MS).
const REPS_PER_SET = 3;
const SET_REST_MS = 2400;
const SET_MS = REP_MS * REPS_PER_SET + SET_REST_MS;

export interface LiftPose {
  phase: LiftPhase;
  rep: number;
  // Horizontal tremble while grinding the bar up, in pixels.
  shakeX: number;
  // Panting with the mouth open during the rest between sets.
  isPanting: boolean;
}

export function liftPose(ms: number): LiftPose {
  const inSet = ms % SET_MS;
  const set = Math.floor(ms / SET_MS);
  if (inSet >= REP_MS * REPS_PER_SET) {
    const restMs = inSet - REP_MS * REPS_PER_SET;
    return { phase: "rest", rep: (set + 1) * REPS_PER_SET, shakeX: 0, isPanting: restMs % 520 < 260 };
  }
  const rep = set * REPS_PER_SET + Math.floor(inSet / REP_MS);
  let at = inSet % REP_MS;
  for (const key of LIFT_KEYS) {
    if (at < key.ms) {
      const shakeX = key.phase === "strain" ? (Math.floor(at / 70) % 2 === 0 ? 0 : 1) : 0;
      return { phase: key.phase, rep, shakeX, isPanting: false };
    }
    at -= key.ms;
  }
  return { phase: "rack", rep, shakeX: 0, isPanting: false };
}

// Breathing in is shorter than breathing out, and a sleeper pauses at the bottom.
const INHALE_MS = 1500;
const EXHALE_MS = 2500;
const BREATH_PAUSE_MS = 600;
export const BREATH_MS = INHALE_MS + EXHALE_MS + BREATH_PAUSE_MS;
// Two breaths facing out (the snot bubble pops on the second), a toss, one facing away:
// about one idle activity long.
const FACING_BREATHS = 2;
const SLEEP_BREATHS = 3;
const TOSS_MS = 420;
const POP_MS = 260;

export interface SleepPose {
  breath: number;
  // 0 at the bottom of a breath, 1 with the lungs full.
  fill: number;
  isExhaling: boolean;
  isFacingAway: boolean;
  // Pixels the bag lifts while the sleeper rolls over.
  tossY: number;
  // Snot bubble size 0..1, inflating on the out-breath; undefined when there is none.
  bubble: number | undefined;
  // Time since the bubble popped, while its spray still shows.
  popMs: number | undefined;
}

export function sleepPose(ms: number): SleepPose {
  const breath = Math.floor(ms / BREATH_MS);
  const at = ms % BREATH_MS;
  const inCycle = breath % SLEEP_BREATHS;
  const isFacingAway = inCycle >= FACING_BREATHS;
  const isExhaling = at >= INHALE_MS && at < INHALE_MS + EXHALE_MS;
  const fill =
    at < INHALE_MS
      ? Math.sin(((at / INHALE_MS) * Math.PI) / 2)
      : isExhaling
        ? 1 - (at - INHALE_MS) / EXHALE_MS
        : 0;
  const isTossing = (inCycle === 0 || inCycle === FACING_BREATHS) && at < TOSS_MS;
  const tossY = isTossing ? Math.round(Math.sin((at / TOSS_MS) * Math.PI) * 1.4) : 0;
  const popsThisBreath = inCycle === FACING_BREATHS - 1;
  const popAt = INHALE_MS + EXHALE_MS * 0.85;
  let bubble: number | undefined;
  let popMs: number | undefined;
  if (!isFacingAway && !isTossing) {
    if (popsThisBreath && at >= popAt) {
      if (at - popAt < POP_MS) popMs = at - popAt;
    } else if (isExhaling) {
      bubble = (at - INHALE_MS) / EXHALE_MS;
    } else if (at < INHALE_MS) {
      // Drawn back in as the breath starts.
      bubble = Math.max(0, 0.35 - at / INHALE_MS);
    }
  }
  return { breath, fill, isExhaling, isFacingAway, tossY, bubble, popMs };
}

export type FlexShot = "front" | "right" | "left";
export type FlexPhase = "breathe" | "snap" | "hit" | "relax";

// Each pose: breathe in and sink, snap into it, hold under tension (trembling), let go.
const FLEX_ORDER: readonly FlexShot[] = ["front", "right", "left"];
const FLEX_BREATHE_MS = 450;
// The arms go up before the muscles tighten.
const FLEX_SNAP_MS = 160;
const FLEX_HOLD_MS = 1500;
const FLEX_RELAX_MS = 450;
const FLEX_POSE_MS = FLEX_BREATHE_MS + FLEX_HOLD_MS + FLEX_RELAX_MS;

export interface FlexPose {
  shot: FlexShot;
  phase: FlexPhase;
  pose: number;
  // Sinks a pixel while breathing in.
  dipY: number;
  shakeX: number;
}

export function flexPose(ms: number): FlexPose {
  const pose = Math.floor(ms / FLEX_POSE_MS);
  const shot = FLEX_ORDER[pose % FLEX_ORDER.length] ?? "front";
  const at = ms % FLEX_POSE_MS;
  if (at < FLEX_BREATHE_MS)
    return { shot, phase: "breathe", pose, dipY: at > FLEX_BREATHE_MS * 0.4 ? 1 : 0, shakeX: 0 };
  const holdMs = at - FLEX_BREATHE_MS;
  if (holdMs < FLEX_SNAP_MS) return { shot, phase: "snap", pose, dipY: 0, shakeX: 0 };
  if (holdMs < FLEX_HOLD_MS) {
    // The tremble builds after the snap settles.
    const shakeX = holdMs > 450 && Math.floor(holdMs / 90) % 2 === 1 ? 1 : 0;
    return { shot, phase: "hit", pose, dipY: 0, shakeX };
  }
  return { shot, phase: "relax", pose, dipY: 0, shakeX: 0 };
}

export type VisitPhase = "descend" | "beam" | "carry" | "landing" | "aboard" | "spit" | "leave";

// The UFO's visits: it drops in over the alien, opens its belly hatch, reaches its beam to the
// ground and carries the alien along it, down to arrive (session start) or up to take it aboard
// (`/alien stats`), then closes up and leaves.
export interface VisitPose {
  phase: VisitPhase;
  // 0 above the pane, 1 hovering over the alien.
  ufo: number;
  // How far open the belly hatch is, 0..1.
  hatch: number;
  // How far the beam reaches from the hatch to the ground, 0..1.
  beam: number;
  // How far up the beam the alien is: 0 on the ground, 1 in the hatch; undefined while aboard.
  rise: number | undefined;
  // The alien sways in the beam, less as it nears either end.
  sway: number;
  // Crouched on touchdown.
  isLanding: boolean;
  // The alien watches the UFO come in.
  isLookingUp: boolean;
  // The board line showing: -1 while the total counts up, then each creature and the boss.
  entry: number;
  // The UFO's lights flash white: a line comes up while the alien is aboard.
  isFlash: boolean;
  // The boss line: the lights keep flashing and the fireworks go up.
  isFinale: boolean;
}

const DESCEND_MS = 600;
const HATCH_MS = 120;
const BEAM_GROW_MS = 120;
const CARRY_MS = 460;
const LANDING_MS = 120;
const LEAVE_MS = 300;
const FLASH_MS = 160;
const FINALE_AT_MS = 140;
const FINALE_END_MS = 900;
const BOSS_ENTRY = 4;
// `/alien stats` spits the alien back out this long before the board is gone.
const SPIT_HATCH_MS = 60;
const SPIT_FALL_MS = 160;
const SPIT_AT_MS = STATS_MS - 800;
const BEAM_AT_MS = DESCEND_MS + HATCH_MS + BEAM_GROW_MS;
const CARRIED_MS = BEAM_AT_MS + CARRY_MS;
export const ARRIVE_MS = CARRIED_MS + LANDING_MS + HATCH_MS + LEAVE_MS;

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

const STILL: Omit<VisitPose, "phase" | "ufo" | "hatch" | "beam" | "rise"> = {
  sway: 0,
  isLanding: false,
  isLookingUp: false,
  entry: -1,
  isFlash: false,
  isFinale: false,
};

// The way in, shared by both visits: drop in, open the hatch, reach the beam down.
function arriving(ms: number, rise: number | undefined): VisitPose {
  if (ms < DESCEND_MS)
    return { ...STILL, phase: "descend", ufo: easeOut(ms / DESCEND_MS), hatch: 0, beam: 0, rise };
  const at = ms - DESCEND_MS;
  return {
    ...STILL,
    phase: "beam",
    ufo: 1,
    hatch: clamp01(at / HATCH_MS),
    beam: clamp01((at - HATCH_MS) / BEAM_GROW_MS),
    rise,
  };
}

const swayAt = (ms: number, t: number): number => Math.round(Math.sin(ms / 80) * Math.sin(t * Math.PI) * 1.4);

// Closes up after a touchdown at `from`, then leaves.
function departing(ms: number, from: number): VisitPose {
  const at = ms - from;
  if (at < LANDING_MS) return { ...STILL, phase: "landing", ufo: 1, hatch: 1, beam: 1, rise: 0, isLanding: true };
  const closing = at - LANDING_MS;
  if (closing < HATCH_MS) {
    const t = closing / HATCH_MS;
    return { ...STILL, phase: "landing", ufo: 1, hatch: 1 - t, beam: 1 - t, rise: 0 };
  }
  const t = clamp01((closing - HATCH_MS) / LEAVE_MS);
  return { ...STILL, phase: "leave", ufo: 1 - t * t, hatch: 0, beam: 0, rise: 0 };
}

// Session start: the alien rides the beam down and the UFO leaves.
export function arrivePose(ms: number): VisitPose {
  if (ms < BEAM_AT_MS) return arriving(ms, undefined);
  if (ms < CARRIED_MS) {
    const t = (ms - BEAM_AT_MS) / CARRY_MS;
    return { ...STILL, phase: "carry", ufo: 1, hatch: 1, beam: 1, rise: 1 - easeOut(t), sway: swayAt(ms, t) };
  }
  return departing(ms, CARRIED_MS);
}

// `/alien stats`: the beam takes the alien up while the total counts; aboard, the lights flash
// as each line comes up and keep flashing through the boss line's fireworks; then the hatch
// pops open, the alien is shot back down to where it stood, and the UFO leaves as the board fades.
export function statsPose(ms: number): VisitPose {
  const entry =
    ms < STATS_TOTAL_MS ? -1 : Math.min(BOSS_ENTRY, Math.floor((ms - STATS_TOTAL_MS) / STATS_ENTRY_MS));
  if (ms < BEAM_AT_MS) return { ...arriving(ms, 0), entry, isLookingUp: true };
  if (ms < CARRIED_MS) {
    const t = (ms - BEAM_AT_MS) / CARRY_MS;
    return { ...STILL, phase: "carry", ufo: 1, hatch: 1, beam: 1, rise: t * t, sway: swayAt(ms, t), entry };
  }
  const local = entry < 0 ? Infinity : ms - STATS_TOTAL_MS - entry * STATS_ENTRY_MS;
  const isFinale = entry === BOSS_ENTRY && local >= FINALE_AT_MS && local < FINALE_END_MS;
  const lights = { entry, isFinale, isFlash: isFinale || local < FLASH_MS };
  if (ms < SPIT_AT_MS) {
    const closing = clamp01((ms - CARRIED_MS) / HATCH_MS);
    return { ...STILL, ...lights, phase: "aboard", ufo: 1, hatch: 1 - closing, beam: 1 - closing, rise: undefined };
  }
  const at = ms - SPIT_AT_MS;
  if (at < SPIT_HATCH_MS) {
    const t = at / SPIT_HATCH_MS;
    return { ...STILL, ...lights, phase: "spit", ufo: 1, hatch: t, beam: t, rise: undefined };
  }
  if (at < SPIT_HATCH_MS + SPIT_FALL_MS) {
    const t = (at - SPIT_HATCH_MS) / SPIT_FALL_MS;
    return { ...STILL, ...lights, phase: "spit", ufo: 1, hatch: 1, beam: 1, rise: 1 - t * t };
  }
  // Touchdown at 5920 ms leaves the UFO gone by 6460, before the board's 6500.
  return { ...departing(ms, SPIT_AT_MS + SPIT_HATCH_MS + SPIT_FALL_MS), entry };
}
