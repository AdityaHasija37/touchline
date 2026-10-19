/** Marker colours that stay legible on the pitch (no colour-only meaning; WCAG 1.4.11 intent). */
export const GRASS = "#3f8f5a";

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex: string, withHex: string, amount: number): string {
  const a = rgb(hex), b = rgb(withHex);
  return "#" + a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, "0")).join("");
}

/** The team's colour, darkened until it separates from the grass by at least 3:1. */
export function markerFill(teamColor: string, grass = GRASS): string {
  let c = teamColor;
  for (let i = 0; i < 10 && contrastRatio(c, grass) < 3; i++) c = mix(c, "#000000", 0.18);
  return c;
}
