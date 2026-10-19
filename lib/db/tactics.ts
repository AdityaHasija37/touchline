import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MatchFormat } from "@/lib/domain/format";
import { boardSchema, type Board, type TacticCategory } from "@/lib/validation/board";

export type TacticSummary = {
  id: string;
  teamId: string;
  name: string;
  category: TacticCategory;
  format: MatchFormat;
  board: Board | null;
  updatedAt: string;
};

export type Tactic = TacticSummary & { board: Board; version: number };

type Row = {
  id: string;
  team_id: string;
  name: string;
  category: string;
  format: number;
  board_json: unknown;
  updated_at: string;
  version: number;
};

const COLUMNS = "id, team_id, name, category, format, board_json, updated_at, version";

function toSummary(r: Row): TacticSummary {
  const parsed = boardSchema.safeParse(r.board_json);
  return {
    id: r.id,
    teamId: r.team_id,
    name: r.name,
    category: r.category as TacticCategory,
    format: r.format as MatchFormat,
    board: parsed.success ? parsed.data : null,
    updatedAt: r.updated_at,
  };
}

export async function listTactics(teamId: string): Promise<TacticSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tactics")
    .select(COLUMNS)
    .eq("team_id", teamId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Couldn't load tactics.");
  return (data as Row[]).map(toSummary);
}

/** Owner-scoped load; anything else is a generic 404 (QA-02). */
export const getTactic = cache(async (tacticId: string): Promise<Tactic> => {
  if (!z.uuid().safeParse(tacticId).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("tactics").select(COLUMNS).eq("id", tacticId).maybeSingle();
  if (!data) notFound();
  const s = toSummary(data as Row);
  if (!s.board) throw new Error("This tactic's board data couldn't be read.");
  return { ...s, board: s.board, version: (data as Row).version };
});
