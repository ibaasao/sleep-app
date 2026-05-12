export type SessionTheme = {
  id: string;
  label: string;
  primaryRgb: [number, number, number];
  accentRgb: [number, number, number];
  particleRgb: [number, number, number];
  lineRgb: [number, number, number];
  glowRgb: [number, number, number];
};

const THEMES: Record<string, SessionTheme> = {
  s1: {
    id: "s1",
    label: "396 Hz",
    primaryRgb: [185, 28, 28],
    accentRgb: [251, 146, 60],
    particleRgb: [252, 165, 165],
    lineRgb: [248, 113, 113],
    glowRgb: [127, 29, 29],
  },
  s2: {
    id: "s2",
    label: "417 Hz",
    primaryRgb: [234, 88, 12],
    accentRgb: [250, 204, 21],
    particleRgb: [253, 186, 116],
    lineRgb: [251, 146, 60],
    glowRgb: [154, 52, 18],
  },
  s3: {
    id: "s3",
    label: "528 Hz",
    primaryRgb: [124, 58, 237],
    accentRgb: [250, 204, 21],
    particleRgb: [216, 180, 254],
    lineRgb: [167, 139, 250],
    glowRgb: [91, 33, 182],
  },
  s4: {
    id: "s4",
    label: "639 Hz",
    primaryRgb: [5, 150, 105],
    accentRgb: [52, 211, 153],
    particleRgb: [110, 231, 183],
    lineRgb: [16, 185, 129],
    glowRgb: [6, 95, 70],
  },
  s5: {
    id: "s5",
    label: "741 Hz",
    primaryRgb: [37, 99, 235],
    accentRgb: [96, 165, 250],
    particleRgb: [147, 197, 253],
    lineRgb: [59, 130, 246],
    glowRgb: [30, 64, 175],
  },
  s6: {
    id: "s6",
    label: "852 Hz",
    primaryRgb: [79, 70, 229],
    accentRgb: [196, 181, 253],
    particleRgb: [165, 180, 252],
    lineRgb: [129, 140, 248],
    glowRgb: [67, 56, 202],
  },
  n1: {
    id: "n1",
    label: "Brown Noise",
    primaryRgb: [120, 113, 108],
    accentRgb: [168, 162, 158],
    particleRgb: [214, 211, 209],
    lineRgb: [168, 162, 158],
    glowRgb: [87, 83, 78],
  },
  n2: {
    id: "n2",
    label: "Pink Noise",
    primaryRgb: [219, 39, 119],
    accentRgb: [244, 114, 182],
    particleRgb: [251, 207, 232],
    lineRgb: [236, 72, 153],
    glowRgb: [157, 23, 77],
  },
  n3: {
    id: "n3",
    label: "Delta Wave",
    primaryRgb: [30, 58, 138],
    accentRgb: [59, 130, 246],
    particleRgb: [147, 197, 253],
    lineRgb: [96, 165, 250],
    glowRgb: [30, 64, 175],
  },
  n4: {
    id: "n4",
    label: "Theta Wave",
    primaryRgb: [109, 40, 217],
    accentRgb: [167, 139, 250],
    particleRgb: [196, 181, 253],
    lineRgb: [139, 92, 246],
    glowRgb: [76, 29, 149],
  },
  n5: {
    id: "n5",
    label: "Deep Ocean",
    primaryRgb: [14, 116, 144],
    accentRgb: [34, 211, 238],
    particleRgb: [103, 232, 249],
    lineRgb: [6, 182, 212],
    glowRgb: [21, 94, 117],
  },
  n6: {
    id: "n6",
    label: "Cosmic Humming",
    primaryRgb: [124, 58, 237],
    accentRgb: [250, 204, 21],
    particleRgb: [216, 180, 254],
    lineRgb: [167, 139, 250],
    glowRgb: [91, 33, 182],
  },
  n7: {
    id: "n7",
    label: "Solstice Breath",
    primaryRgb: [124, 58, 237],
    accentRgb: [250, 204, 21],
    particleRgb: [216, 180, 254],
    lineRgb: [167, 139, 250],
    glowRgb: [91, 33, 182],
  },
  rain: {
    id: "rain",
    label: "Rainy Night",
    primaryRgb: [71, 85, 105],
    accentRgb: [148, 163, 184],
    particleRgb: [203, 213, 225],
    lineRgb: [148, 163, 184],
    glowRgb: [51, 65, 85],
  },
};

const DEFAULT_THEME = THEMES.s3;

export function getSessionTheme(soundId: string): SessionTheme {
  return THEMES[soundId] ?? DEFAULT_THEME;
}

export const BREATH_CYCLE_MS = 10000;

export function getBreathPulse(timeMs: number): number {
  const phase = (timeMs % BREATH_CYCLE_MS) / BREATH_CYCLE_MS;
  const inhale = phase < 0.5;
  const t = inhale ? phase * 2 : (phase - 0.5) * 2;
  const eased = 0.5 - Math.cos(t * Math.PI) / 2;
  return inhale ? eased : 1 - eased;
}

export function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
