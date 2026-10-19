// Keyframe timelines for the idle routines and the stats party. Pure functions of the elapsed
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

export type PartyPhase = "descend" | "beam" | "party" | "lift" | "leave";

// `/alien stats`: a UFO drops in over the alien and beams a robot down beside it before the
// board's first line; the two high-five as each line shows, the boss line is the finale, and
// the UFO takes the robot back and leaves as the board fades.
const DESCEND_MS = 600;
const DROP_MS = 600;
const LIFT_MS = 250;
const LEAVE_MS = 250;
const HIGH_FIVE_MS = 350;
// The hands meet partway into the swing.
const SLAP_AT_MS = 120;
const FINALE_MS = 400;
const LANDED_MS = DESCEND_MS + DROP_MS;
const LIFT_AT_MS = STATS_MS - LIFT_MS - LEAVE_MS;
const BOSS_ENTRY = 4;

export interface PartyPose {
  phase: PartyPhase;
  // 0 above the pane, 1 hovering over the alien.
  ufo: number;
  // 0 at the hatch, 1 on the ground; undefined while aboard.
  robot: number | undefined;
  isBeamOn: boolean;
  // The board line showing: -1 while the total counts up, then each creature and the boss.
  entry: number;
  isHighFive: boolean;
  // The hands are touching.
  isSlap: boolean;
  isFinale: boolean;
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

export function partyPose(ms: number): PartyPose {
  const entry =
    ms < STATS_TOTAL_MS ? -1 : Math.min(BOSS_ENTRY, Math.floor((ms - STATS_TOTAL_MS) / STATS_ENTRY_MS));
  const quiet = { entry, isHighFive: false, isSlap: false, isFinale: false };
  if (ms < DESCEND_MS)
    return { ...quiet, phase: "descend", ufo: easeOut(ms / DESCEND_MS), robot: undefined, isBeamOn: false };
  if (ms < LANDED_MS) {
    const t = (ms - DESCEND_MS) / DROP_MS;
    return { ...quiet, phase: "beam", ufo: 1, robot: t * t * (3 - 2 * t), isBeamOn: true };
  }
  if (ms < LIFT_AT_MS) {
    const local = entry < 0 ? Infinity : ms - STATS_TOTAL_MS - entry * STATS_ENTRY_MS;
    return {
      phase: "party",
      ufo: 1,
      robot: 1,
      isBeamOn: false,
      entry,
      isHighFive: local < HIGH_FIVE_MS,
      isSlap: local >= SLAP_AT_MS && local < HIGH_FIVE_MS,
      isFinale: entry === BOSS_ENTRY && local < FINALE_MS,
    };
  }
  if (ms < LIFT_AT_MS + LIFT_MS)
    return { ...quiet, phase: "lift", ufo: 1, robot: 1 - (ms - LIFT_AT_MS) / LIFT_MS, isBeamOn: true };
  const t = Math.min(1, (ms - LIFT_AT_MS - LIFT_MS) / LEAVE_MS);
  return { ...quiet, phase: "leave", ufo: 1 - t * t, robot: undefined, isBeamOn: false };
}
