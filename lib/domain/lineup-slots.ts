import type { Formation } from "./formations";
import { defaultRoleFor, positionFit, roleByKey, slotGroup, type Duty } from "./roles";
import type { Position } from "@/lib/validation/player";
import type { LineupEntry } from "@/lib/validation/match";

/**
 * Squad-on-the-pitch rules (enhancement 2). Pure so they can be unit-tested:
 * with a formation, every starter holds a unique slot and takes that slot's label as position;
 * a role that doesn't suit the new slot is replaced by the slot's default role.
 */
export function withFormation(entries: LineupEntry[], formation: Formation | null, preferred: (playerId: string) => Position[]): LineupEntry[] {
  if (!formation) return entries.map((e) => (e.role === "starter" ? { ...e, slot: undefined } : e));
  const n = formation.slots.length;
  const taken = new Set<number>();
  const starters = entries.filter((e) => e.role === "starter");
  const keep = new Map<string, number>();
  for (const e of starters) {
    if (e.slot && e.slot <= n && !taken.has(e.slot)) {
      taken.add(e.slot);
      keep.set(e.playerId, e.slot);
    }
  }
  // Unplaced starters take the empty slot that suits them best (natural, then adjacent, then any).
  const rank = { natural: 0, adjacent: 1, unknown: 2, out: 3 } as const;
  for (const e of starters) {
    if (keep.has(e.playerId)) continue;
    const free = formation.slots.map((_, i) => i + 1).filter((s) => !taken.has(s));
    if (!free.length) break;
    const best = free.sort((a, b) => rank[positionFit(preferred(e.playerId), formation.slots[a - 1][0])] - rank[positionFit(preferred(e.playerId), formation.slots[b - 1][0])])[0];
    taken.add(best);
    keep.set(e.playerId, best);
  }
  return entries.map((e) => (e.role === "starter" && keep.has(e.playerId) ? fitRole({ ...e, slot: keep.get(e.playerId)!, position: formation.slots[keep.get(e.playerId)! - 1][0] }) : e));
}

/** Keep a role only if it suits the starter's position; otherwise use the slot default. */
export function fitRole(e: LineupEntry): LineupEntry {
  const group = slotGroup(e.position);
  const role = roleByKey(e.playerRole);
  if (role && (!group || role.groups.includes(group))) {
    return { ...e, duty: e.duty && role.duties.includes(e.duty as Duty) ? e.duty : role.duties[0] };
  }
  const d = defaultRoleFor(e.position);
  return d ? { ...e, playerRole: d.role, duty: d.duty } : { ...e, playerRole: undefined, duty: undefined };
}

/** Put a player in a formation slot: swaps with a starter already there, or benches them. */
export function assignSlot(entries: LineupEntry[], formation: Formation, slot: number, playerId: string | null): LineupEntry[] {
  const occupant = entries.find((e) => e.role === "starter" && e.slot === slot);
  const mover = playerId ? entries.find((e) => e.playerId === playerId) : undefined;
  const label = formation.slots[slot - 1][0];
  let next = entries;
  if (occupant && occupant.playerId !== playerId) {
    next = next.map((e) => {
      if (e.playerId !== occupant.playerId) return e;
      if (mover?.role === "starter" && mover.slot) return fitRole({ ...e, slot: mover.slot, position: formation.slots[mover.slot - 1][0] });
      return toBench(e);
    });
  }
  if (!playerId) return next;
  const placed = fitRole({ ...(mover ?? { playerId }), playerId, role: "starter", slot, position: label });
  return mover ? next.map((e) => (e.playerId === playerId ? placed : e)) : [...next, placed];
}

export function toBench(e: LineupEntry): LineupEntry {
  return { playerId: e.playerId, role: "bench" };
}
