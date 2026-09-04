// Rampes ordinales à teinte unique, validées avec le script du skill dataviz
// (lightness monotone, contraste bout clair >= 2:1, distinction CVD/vision normale) :
// node scripts/validate_palette.js "<hex,...>" --mode light|dark --ordinal
export const EFFORT4_LIGHT = ["#e8a06b", "#d97f3f", "#c1531f", "#8a2f16"];
export const EFFORT4_DARK = ["#8a2f16", "#c1531f", "#d97f3f", "#e8a06b"];
export const EFFORT5_LIGHT = ["#e8a06b", "#d97f3f", "#c1531f", "#a13c16", "#6b2410"];
export const EFFORT5_DARK = ["#6b2410", "#a13c16", "#c1531f", "#d97f3f", "#e8a06b"];

export function effortRamp(n: 4 | 5, dark: boolean): string[] {
  if (n === 4) return dark ? EFFORT4_DARK : EFFORT4_LIGHT;
  return dark ? EFFORT5_DARK : EFFORT5_LIGHT;
}
