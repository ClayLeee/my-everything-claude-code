import { setPixel } from "../shared/pixel/bitmap";
import type { Bitmap, Color } from "../shared/pixel/bitmap";
import { lerp, mixColors } from "../shared/pixel/colors";
import type { Mode, Phase } from "../sim/types";

export type SkyStyle = {
  ground: Color;
  groundEdge: Color;
  groundShade: Color;
  mountain: Color;
  mountainRim: Color;
  flora: Color;
  sun: Color;
  sunGlow: Color;
  sunX: number;
  sunY: number;
  sunAmount: number;
  moonAmount: number;
  starAmount: number;
  cloud: Color;
  cloudAmount: number;
};

const NIGHT: SkyStyle = {
  ground: 0x3a2a5c,
  groundEdge: 0x5c4590,
  groundShade: 0x22183a,
  mountain: 0x1c1436,
  mountainRim: 0x3b2d66,
  flora: 0x5ff5e0,
  sun: 0xffc36b,
  sunGlow: 0x8a5a3a,
  sunX: 0.5,
  sunY: 1.2,
  sunAmount: 0,
  moonAmount: 1,
  starAmount: 1,
  cloud: 0x2a2450,
  cloudAmount: 0,
};

const PHASES: Record<Phase, SkyStyle> = {
  dawn: {
    ground: 0x8a4f6e,
    groundEdge: 0xc77a96,
    groundShade: 0x4f2a42,
    mountain: 0x5a3060,
    mountainRim: 0xe08aa8,
    flora: 0xffb3d1,
    sun: 0xffd08a,
    sunGlow: 0xd9786f,
    sunX: 0.14,
    sunY: 0.5,
    sunAmount: 1,
    moonAmount: 0,
    starAmount: 0.25,
    cloud: 0xf2a6b8,
    cloudAmount: 1,
  },
  noon: {
    ground: 0x3f8f7a,
    groundEdge: 0x7fd1b5,
    groundShade: 0x22584a,
    mountain: 0x2f6e78,
    mountainRim: 0x8fd8e0,
    flora: 0xfff27a,
    sun: 0xfffbe0,
    sunGlow: 0xfff0a0,
    sunX: 0.5,
    sunY: 0.05,
    sunAmount: 1,
    moonAmount: 0,
    starAmount: 0,
    cloud: 0xe8fbff,
    cloudAmount: 1,
  },
  dusk: {
    ground: 0x9a4a2a,
    groundEdge: 0xe08850,
    groundShade: 0x52240f,
    mountain: 0x4a1f2e,
    mountainRim: 0xff9a5a,
    flora: 0xffd36b,
    sun: 0xff7a3a,
    sunGlow: 0xb8402a,
    sunX: 0.72,
    sunY: 0.5,
    sunAmount: 1,
    moonAmount: 0.4,
    starAmount: 0.45,
    cloud: 0xd9705a,
    cloudAmount: 0.7,
  },
  night: {
    ...NIGHT,
    ground: 0x2c2c5e,
    groundEdge: 0x4a4a96,
    groundShade: 0x181838,
    flora: 0x6fd6ff,
  },
};

export function skyFor(mode: Mode): SkyStyle {
  return mode.kind === "openspec" ? PHASES[mode.phase] : NIGHT;
}

export function blendSky(from: SkyStyle, to: SkyStyle, amount: number): SkyStyle {
  if (amount >= 1) return to;
  const mix = (start: Color, end: Color): Color => mixColors({ from: start, to: end, amount });
  const num = (start: number, end: number): number => lerp({ from: start, to: end, amount });
  return {
    ground: mix(from.ground, to.ground),
    groundEdge: mix(from.groundEdge, to.groundEdge),
    groundShade: mix(from.groundShade, to.groundShade),
    mountain: mix(from.mountain, to.mountain),
    mountainRim: mix(from.mountainRim, to.mountainRim),
    flora: mix(from.flora, to.flora),
    sun: mix(from.sun, to.sun),
    sunGlow: mix(from.sunGlow, to.sunGlow),
    sunX: num(from.sunX, to.sunX),
    sunY: num(from.sunY, to.sunY),
    sunAmount: num(from.sunAmount, to.sunAmount),
    moonAmount: num(from.moonAmount, to.moonAmount),
    starAmount: num(from.starAmount, to.starAmount),
    cloud: mix(from.cloud, to.cloud),
    cloudAmount: num(from.cloudAmount, to.cloudAmount),
  };
}

const SUN_ROWS = ["..ggg..", ".gsssg.", "gsssssg", "gsssssg", "gsssssg", ".gsssg.", "..ggg.."];
const BIG_MOON_ROWS = [".mmm.", "mmmMm", "mMmmm", "mmmmM", ".mmm."];
const SMALL_MOON_ROWS = ["rr", "rR"];
const PLANET_ROWS = ["....ppp....", "iiipppppiii", ".ppppPPppp.", "....PPP...."];
const CLOUD_ROWS = ["..ccc...", ".ccccccc", "cccccccc"];
const MUSHROOM_ROWS = [".F.", "FFF", ".s."];
const TALL_PLANT_ROWS = [".F.", "F.F", ".s.", ".s.", "s.."];

function noise(index: number): number {
  const raw = Math.sin(index * 91.17 + 7.3) * 43758.5453;
  return raw - Math.floor(raw);
}

function paint(
  bitmap: Bitmap,
  rows: readonly string[],
  x: number,
  y: number,
  colors: Readonly<Record<string, Color>>,
): void {
  rows.forEach((row, dy) => {
    Array.from(row).forEach((cell, dx) => {
      const color = colors[cell];
      if (color !== undefined) setPixel({ bitmap, x: x + dx, y: y + dy, color });
    });
  });
}

function ridgeHeight(x: number, maxHeight: number): number {
  const wave =
    Math.sin(x / 6.3) * 0.55 + Math.sin(x / 2.7 + 1.3) * 0.25 + Math.sin(x / 13 + 0.4) * 0.45;
  return Math.max(1, Math.round(((wave + 1.25) / 2.5) * maxHeight));
}

export function drawSky(options: {
  bitmap: Bitmap;
  sky: SkyStyle;
  clockMs: number;
  floor: number;
}): void {
  const { bitmap, sky, clockMs, floor } = options;
  const isTall = bitmap.height > 16;
  const ridgeMax = isTall ? 8 : 4;
  const horizon = floor - 1;

  const starCount = Math.round((bitmap.width / (isTall ? 3 : 4)) * sky.starAmount);
  for (let index = 0; index < starCount; index += 1) {
    const x = Math.floor(noise(index) * bitmap.width);
    const y = Math.floor(noise(index + 500) * Math.max(1, horizon - ridgeMax));
    const twinkle = Math.sin(clockMs / 700 + index * 1.7);
    setPixel({
      bitmap,
      x,
      y,
      color: twinkle > 0.6 ? 0xffffff : twinkle > -0.2 ? 0xa9aedb : 0x5a5f8a,
    });
  }

  if (isTall && sky.moonAmount > 0.5) {
    paint(bitmap, PLANET_ROWS, 4, 2, { p: 0x8a6ad8, P: 0x5a3fa6, i: 0xd9c8ff });
  }

  if (sky.sunAmount > 0.5) {
    const skyHeight = Math.max(1, horizon - 4);
    const x = Math.round(sky.sunX * (bitmap.width - 7));
    const y = Math.round(sky.sunY * skyHeight);
    paint(bitmap, SUN_ROWS, x, y, { s: sky.sun, g: sky.sunGlow });
  }

  if (sky.moonAmount > 0.5) {
    paint(bitmap, BIG_MOON_ROWS, bitmap.width - 20, 1, { m: 0xdfe6ff, M: 0xa9b3d9 });
    paint(bitmap, SMALL_MOON_ROWS, bitmap.width - 11, isTall ? 6 : 4, { r: 0xffa58f, R: 0xc4685a });
  }

  if (sky.cloudAmount > 0.5) {
    const span = bitmap.width + 16;
    for (let index = 0; index < (isTall ? 3 : 2); index += 1) {
      const drift = (clockMs / (180 + index * 70) + noise(index + 40) * span) % span;
      paint(bitmap, CLOUD_ROWS, Math.round(drift) - 8, 1 + index * (isTall ? 4 : 2), {
        c: sky.cloud,
      });
    }
  }

  for (let x = 0; x < bitmap.width; x += 1) {
    const height = ridgeHeight(x, ridgeMax);
    for (let dy = 0; dy < height; dy += 1) {
      setPixel({
        bitmap,
        x,
        y: horizon - dy,
        color: dy === height - 1 ? sky.mountainRim : sky.mountain,
      });
    }
  }

  for (let x = 0; x < bitmap.width; x += 1) {
    setPixel({ bitmap, x, y: floor, color: noise(x + 300) > 0.7 ? sky.groundEdge : sky.ground });
    for (let y = floor + 1; y < bitmap.height; y += 1) {
      const speck = noise(x * 31 + y * 7) > 0.88;
      setPixel({ bitmap, x, y, color: speck ? sky.ground : sky.groundShade });
    }
  }

  const floraColors = {
    F: sky.flora,
    s: mixColors({ from: sky.groundShade, to: 0xffffff, amount: 0.35 }),
  };
  for (let x = 16; x < bitmap.width - 2; x += 1) {
    const roll = noise(x + 900);
    if (roll > 0.93) paint(bitmap, MUSHROOM_ROWS, x, floor - 3, floraColors);
    else if (isTall && roll > 0.89) paint(bitmap, TALL_PLANT_ROWS, x, floor - 5, floraColors);
    else if (roll > 0.86) {
      setPixel({ bitmap, x, y: floor - 1, color: sky.flora });
      setPixel({ bitmap, x, y: floor, color: sky.flora });
    }
  }
}
