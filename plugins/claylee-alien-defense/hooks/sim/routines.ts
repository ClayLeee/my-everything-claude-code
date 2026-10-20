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
// A high-five: the arm cocks back with a crouch, the hands meet (the scene holds for a beat),
// then the two bounce apart.
export type FivePhase = "windup" | "slap" | "recoil";

export interface Hop {
  // Pixels off the ground.
  lift: number;
  // Squashed while pushing off and while landing.
  isCrouched: boolean;
}

// `/alien stats`: a UFO drops in over the alien, opens its belly hatch and beams a robot down
// beside it before the board's first line; the two high-five as each line shows and hop in
// turns between, the boss line ends in a big jump all together, and the UFO takes the robot
// back and leaves as the board fades.
const DESCEND_MS = 600;
const HATCH_MS = 120;
const BEAM_GROW_MS = 120;
const LANDED_MS = 1200;
const DROP_AT_MS = DESCEND_MS + HATCH_MS + BEAM_GROW_MS;
const LANDING_MS = 100;
const LIFT_MS = 250;
const LEAVE_MS = 250;
const LIFT_AT_MS = STATS_MS - LIFT_MS - LEAVE_MS;
const WINDUP_MS = 140;
const SLAP_MS = 80;
const RECOIL_MS = 160;
const FINALE_JUMP_AT_MS = WINDUP_MS + SLAP_MS + RECOIL_MS;
const FINALE_END_MS = 900;
// Each hops on its own beat, half a hop apart, like a call and its answer.
const HOP_MS = 640;
const CROUCH_MS = 80;
const BOSS_ENTRY = 4;

export interface PartyPose {
  phase: PartyPhase;
  // 0 above the pane, 1 hovering over the alien.
  ufo: number;
  // How far open the belly hatch is, 0..1.
  hatch: number;
  // How far the beam reaches from the hatch to the ground, 0..1.
  beam: number;
  // 0 at the hatch, 1 on the ground; undefined while aboard.
  robot: number | undefined;
  // The robot sways in the beam, less as it nears the ground.
  robotSway: number;
  // The board line showing: -1 while the total counts up, then each creature and the boss.
  entry: number;
  five: FivePhase | undefined;
  isHighFive: boolean;
  // The hands are touching.
  isSlap: boolean;
  isFinale: boolean;
  alien: Hop;
  robotHop: Hop;
  // The robot has just touched down.
  isLanding: boolean;
}

const GROUNDED: Hop = { lift: 0, isCrouched: false };

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

// Crouch, rise and fall over `airMs`, crouch again on landing.
function jump(at: number, height: number, airMs: number): Hop {
  if (at < 0) return GROUNDED;
  if (at < CROUCH_MS) return { lift: 0, isCrouched: true };
  if (at < CROUCH_MS + airMs)
    return { lift: Math.round(height * Math.sin(((at - CROUCH_MS) / airMs) * Math.PI)), isCrouched: false };
  if (at < CROUCH_MS * 2 + airMs) return { lift: 0, isCrouched: true };
  return GROUNDED;
}

const hop = (ms: number): Hop => jump(ms % HOP_MS, 2, 400);

export function partyPose(ms: number): PartyPose {
  const entry =
    ms < STATS_TOTAL_MS ? -1 : Math.min(BOSS_ENTRY, Math.floor((ms - STATS_TOTAL_MS) / STATS_ENTRY_MS));
  const quiet = {
    entry,
    five: undefined,
    isHighFive: false,
    isSlap: false,
    isFinale: false,
    robotSway: 0,
    alien: GROUNDED,
    robotHop: GROUNDED,
    isLanding: false,
  };
  if (ms < DESCEND_MS)
    return {
      ...quiet,
      phase: "descend",
      ufo: easeOut(ms / DESCEND_MS),
      hatch: 0,
      beam: 0,
      robot: undefined,
    };
  if (ms < LANDED_MS) {
    const at = ms - DESCEND_MS;
    // Still aboard until the beam reaches the ground.
    const robot = ms < DROP_AT_MS ? undefined : easeOut((ms - DROP_AT_MS) / (LANDED_MS - DROP_AT_MS));
    return {
      ...quiet,
      phase: "beam",
      ufo: 1,
      hatch: clamp01(at / HATCH_MS),
      beam: clamp01((at - HATCH_MS) / BEAM_GROW_MS),
      robot,
      robotSway: robot === undefined ? 0 : Math.round(Math.sin(ms / 80) * 1.4 * (1 - robot)),
    };
  }
  if (ms < LIFT_AT_MS) {
    const local = entry < 0 ? Infinity : ms - STATS_TOTAL_MS - entry * STATS_ENTRY_MS;
    const five: FivePhase | undefined =
      local < WINDUP_MS
        ? "windup"
        : local < WINDUP_MS + SLAP_MS
          ? "slap"
          : local < FINALE_JUMP_AT_MS
            ? "recoil"
            : undefined;
    const isFinale = entry === BOSS_ENTRY && local >= WINDUP_MS && local < FINALE_END_MS;
    const isLanding = ms < LANDED_MS + LANDING_MS;
    let alien = five === "windup" ? { lift: 0, isCrouched: true } : five ? GROUNDED : hop(ms);
    let robotHop =
      five === "windup" || isLanding ? { lift: 0, isCrouched: true } : five ? GROUNDED : hop(ms + HOP_MS / 2);
    if (isFinale && !five) {
      alien = jump(local - FINALE_JUMP_AT_MS, 4, 360);
      robotHop = alien;
    }
    return {
      ...quiet,
      phase: "party",
      ufo: 1,
      hatch: clamp01(1 - (ms - LANDED_MS) / HATCH_MS),
      beam: 0,
      robot: 1,
      five,
      isHighFive: five !== undefined,
      isSlap: five === "slap",
      isFinale,
      alien,
      robotHop,
      isLanding,
    };
  }
  if (ms < LIFT_AT_MS + LIFT_MS) {
    const at = ms - LIFT_AT_MS;
    const riseAt = HATCH_MS / 2 + BEAM_GROW_MS / 2;
    const t = clamp01((at - riseAt) / (LIFT_MS - riseAt));
    return {
      ...quiet,
      phase: "lift",
      ufo: 1,
      hatch: clamp01(at / (HATCH_MS / 2)),
      beam: clamp01((at - HATCH_MS / 2) / (BEAM_GROW_MS / 2)),
      robot: 1 - t * t,
    };
  }
  const at = ms - LIFT_AT_MS - LIFT_MS;
  const t = clamp01(at / LEAVE_MS);
  return {
    ...quiet,
    phase: "leave",
    ufo: 1 - t * t,
    hatch: clamp01(1 - at / (HATCH_MS / 2)),
    beam: 0,
    robot: undefined,
  };
}
