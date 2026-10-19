import { TEAM_COLORS } from "@/lib/validation/team";

/** Every swatch has a name so colour is never the only signal (WCAG 1.4.1). */
export const TEAM_COLOR_NAMES: Record<(typeof TEAM_COLORS)[number], string> = {
  "#2f7d4f": "Grass green",
  "#1d4ed8": "Royal blue",
  "#b91c1c": "Red",
  "#7c3aed": "Purple",
  "#c2410c": "Orange",
  "#0f766e": "Teal",
  "#111827": "Black",
  "#ca8a04": "Gold",
};

export function colorName(hex: string): string {
  return TEAM_COLOR_NAMES[hex as keyof typeof TEAM_COLOR_NAMES] ?? hex;
}
