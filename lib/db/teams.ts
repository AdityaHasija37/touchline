import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormat } from "@/lib/domain/format";
import type { Position } from "@/lib/validation/player";

export type Team = {
  id: string;
  name: string;
  matchFormat: MatchFormat;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamSummary = Team & { activePlayers: number };

export type Player = {
  id: string;
  teamId: string;
  name: string;
  shirtNumber: number | null;
  preferredPositions: Position[];
  archivedAt: string | null;
};

const uuid = z.uuid();

type TeamRow = {
  id: string;
  name: string;
  match_format: number;
  primary_color: string;
  created_at: string;
  updated_at: string;
};

const toTeam = (r: TeamRow): Team => ({
  id: r.id,
  name: r.name,
  matchFormat: r.match_format as MatchFormat,
  primaryColor: r.primary_color,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listTeams(): Promise<TeamSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, match_format, primary_color, created_at, updated_at, players(count)")
    .is("players.archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Couldn't load your teams.");
  return data.map((r) => ({
    ...toTeam(r),
    activePlayers: (r.players as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

/**
 * Loads a team the caller owns. Anything else (bad id, someone else's team, deleted) is a
 * plain 404 so other teams' existence is never disclosed (UX-002 §7, QA-02).
 */
export const getTeam = cache(async (teamId: string): Promise<Team> => {
  if (!uuid.safeParse(teamId).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, name, match_format, primary_color, created_at, updated_at")
    .eq("id", teamId)
    .maybeSingle();
  if (!data) notFound();
  return toTeam(data);
});

export async function listPlayers(teamId: string): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, team_id, name, shirt_number, preferred_positions, archived_at")
    .eq("team_id", teamId)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("shirt_number", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw new Error("Couldn't load the squad.");
  return data.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    name: r.name,
    shirtNumber: r.shirt_number,
    preferredPositions: r.preferred_positions as Position[],
    archivedAt: r.archived_at,
  }));
}
