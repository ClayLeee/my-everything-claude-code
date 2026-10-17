export type MonsterKind = "slime" | "eyeworm" | "moth" | "squid";

export type Phase = "dawn" | "noon" | "dusk" | "night";

export type Mode =
  | { kind: "free" }
  | { kind: "openspec"; change: string; phase: Phase; docs: number; done: number; total: number };

export type Monster = {
  id: number;
  kind: MonsterKind;
  label: string;
  x: number;
  hitsRemaining: number;
  isDoomed: boolean;
  phase: "alive" | "dying";
  phaseMs: number;
  flashMs: number;
  walkMs: number;
};

export type Boss = {
  x: number;
  hitsRemaining: number;
  phase: "enter" | "fight" | "dying";
  phaseMs: number;
  flashMs: number;
  walkMs: number;
  title: string;
};

export type IdleActivity = "sleep" | "workout" | "flex";

export type AlienMode = "idle" | "wake" | "ready" | "aim" | "fire" | "cooldown" | "cheer";

export type Alien = {
  mode: AlienMode;
  modeMs: number;
  clockMs: number;
  activity: IdleActivity;
  activityMs: number;
  activityLengthMs: number;
  targetX: number;
  hasStruck: boolean;
  isCheerRequested: boolean;
};

export type EffectKind = "hit" | "muzzle" | "blast" | "sparkle" | "sweat" | "zee";

export type Effect = { kind: EffectKind; x: number; y: number; ageMs: number };

export type Tally = Record<MonsterKind, number>;
