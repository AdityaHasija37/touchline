import type { Position } from "@/lib/validation/player";

/**
 * Player roles and duties, in the spirit of Football Manager: a role says *how* a player fills a
 * position, a duty says how adventurous they are (Defend / Support / Attack).
 */
export type Group = "GK" | "DEF" | "MID" | "FWD";
export type Duty = "defend" | "support" | "attack";

export const DUTIES: Duty[] = ["defend", "support", "attack"];
export const DUTY_LABELS: Record<Duty, string> = { defend: "Defend", support: "Support", attack: "Attack" };

export type Role = { key: string; label: string; groups: Group[]; duties: Duty[]; blurb: string };

export const ROLES: readonly Role[] = [
  { key: "goalkeeper", label: "Goalkeeper", groups: ["GK"], duties: ["defend"], blurb: "Stays on the line, commands the box." },
  { key: "sweeper_keeper", label: "Sweeper keeper", groups: ["GK"], duties: ["defend", "support", "attack"], blurb: "Plays high, sweeps behind the defence, starts attacks." },
  { key: "centre_back", label: "Centre-back", groups: ["DEF"], duties: ["defend", "support"], blurb: "Wins headers and tackles, keeps it simple." },
  { key: "ball_playing_defender", label: "Ball-playing defender", groups: ["DEF"], duties: ["defend", "support"], blurb: "Steps in with the ball and breaks lines with passes." },
  { key: "no_nonsense_defender", label: "No-nonsense defender", groups: ["DEF"], duties: ["defend"], blurb: "Clears first, asks questions later." },
  { key: "full_back", label: "Full-back", groups: ["DEF"], duties: ["defend", "support", "attack"], blurb: "Defends the flank, overlaps when it's on." },
  { key: "wing_back", label: "Wing-back", groups: ["DEF", "MID"], duties: ["defend", "support", "attack"], blurb: "Owns the whole touchline, provides the width." },
  { key: "inverted_wing_back", label: "Inverted wing-back", groups: ["DEF"], duties: ["defend", "support"], blurb: "Tucks into midfield when we have the ball." },
  { key: "ball_winning_midfielder", label: "Ball-winning midfielder", groups: ["MID"], duties: ["defend", "support"], blurb: "Hunts the ball and breaks up play." },
  { key: "deep_lying_playmaker", label: "Deep-lying playmaker", groups: ["MID"], duties: ["defend", "support"], blurb: "Sits deep and sets the tempo." },
  { key: "box_to_box", label: "Box-to-box midfielder", groups: ["MID"], duties: ["support"], blurb: "Gets up and down, arrives late in the box." },
  { key: "advanced_playmaker", label: "Advanced playmaker", groups: ["MID", "FWD"], duties: ["support", "attack"], blurb: "Finds pockets between the lines and creates." },
  { key: "wide_midfielder", label: "Wide midfielder", groups: ["MID"], duties: ["defend", "support", "attack"], blurb: "Works the flank both ways." },
  { key: "winger", label: "Winger", groups: ["MID", "FWD"], duties: ["support", "attack"], blurb: "Stays wide, beats the full-back, crosses." },
  { key: "inverted_winger", label: "Inverted winger", groups: ["MID", "FWD"], duties: ["support", "attack"], blurb: "Cuts inside onto the stronger foot." },
  { key: "inside_forward", label: "Inside forward", groups: ["FWD"], duties: ["support", "attack"], blurb: "Drifts in from wide to shoot." },
  { key: "pressing_forward", label: "Pressing forward", groups: ["FWD"], duties: ["defend", "support", "attack"], blurb: "Leads the press from the front." },
  { key: "target_man", label: "Target man", groups: ["FWD"], duties: ["support", "attack"], blurb: "Holds it up and brings others in." },
  { key: "poacher", label: "Poacher", groups: ["FWD"], duties: ["attack"], blurb: "Lives on the shoulder, finishes chances." },
  { key: "false_nine", label: "False nine", groups: ["FWD"], duties: ["support"], blurb: "Drops deep to pull defenders out." },
];

export const ROLE_KEYS = ROLES.map((r) => r.key) as [string, ...string[]];
export const roleByKey = (key: string | null | undefined) => ROLES.find((r) => r.key === key) ?? null;

const SLOT_GROUP: Record<string, Group> = {
  GK: "GK",
  CB: "DEF", LB: "DEF", RB: "DEF", DF: "DEF", LWB: "DEF", RWB: "DEF",
  DM: "MID", CM: "MID", LM: "MID", RM: "MID",
  LW: "FWD", RW: "FWD", LF: "FWD", RF: "FWD", ST: "FWD",
};

/** Position group for a formation slot label ("LB", "ST"…); free-text labels fall back to null. */
export function slotGroup(label: string | null | undefined): Group | null {
  return label ? (SLOT_GROUP[label.toUpperCase()] ?? null) : null;
}

export function rolesFor(group: Group | null): Role[] {
  return group ? ROLES.filter((r) => r.groups.includes(group)) : [...ROLES];
}

const DEFAULT_ROLE: Record<string, string> = {
  GK: "goalkeeper", CB: "centre_back", DF: "centre_back", LB: "full_back", RB: "full_back", LWB: "wing_back", RWB: "wing_back",
  DM: "ball_winning_midfielder", CM: "box_to_box", LM: "wide_midfielder", RM: "wide_midfielder",
  LW: "winger", RW: "winger", LF: "inside_forward", RF: "inside_forward", ST: "pressing_forward",
};

/** A sensible starting role + duty for a slot, so a lineup is meaningful before any editing. */
export function defaultRoleFor(label: string | null | undefined): { role: string; duty: Duty } | null {
  const key = label ? DEFAULT_ROLE[label.toUpperCase()] : undefined;
  if (!key) return null;
  return { role: key, duty: key === "goalkeeper" ? "defend" : "support" };
}

export type Fit = "natural" | "adjacent" | "out" | "unknown";

const ORDER: Group[] = ["GK", "DEF", "MID", "FWD"];

/**
 * How well a player suits a slot, like EA FC position chemistry / FM role suitability:
 * natural (plays there), adjacent (one line away), out (wrong line, or keeper vs outfield).
 */
export function positionFit(preferred: Position[], label: string | null | undefined): Fit {
  const group = slotGroup(label);
  if (!group || preferred.length === 0) return "unknown";
  if (preferred.includes(group)) return "natural";
  if (group === "GK" || preferred.every((p) => p === "GK")) return "out";
  const i = ORDER.indexOf(group);
  return preferred.some((p) => Math.abs(ORDER.indexOf(p) - i) === 1) ? "adjacent" : "out";
}

export function roleSummary(role: string | null | undefined, duty: Duty | null | undefined): string | null {
  const r = roleByKey(role);
  if (!r) return null;
  return duty ? `${r.label} (${DUTY_LABELS[duty]})` : r.label;
}
