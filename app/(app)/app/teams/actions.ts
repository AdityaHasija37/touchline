"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsOf, type ActionState } from "@/lib/validation/form";
import { playerSchema } from "@/lib/validation/player";
import { teamSchema } from "@/lib/validation/team";

const uuid = z.uuid();
const NOT_FOUND: ActionState = { status: "error", message: "That item no longer exists or you don't have access." };

function teamValues(fd: FormData) {
  return { name: fd.get("name"), matchFormat: fd.get("matchFormat"), primaryColor: fd.get("primaryColor") ?? undefined };
}

function playerValues(fd: FormData) {
  return {
    name: fd.get("name"),
    shirtNumber: fd.get("shirtNumber"),
    preferredPositions: fd.getAll("preferredPositions"),
  };
}

// --- Teams (TEAM-01) --------------------------------------------------------

export async function createTeam(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const raw = teamValues(fd);
  const parsed = teamSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name: parsed.data.name, match_format: parsed.data.matchFormat, primary_color: parsed.data.primaryColor })
    .select("id")
    .single();
  if (error) return { status: "error", message: "Couldn't create the team. Try again.", values: raw };

  revalidatePath("/app/teams");
  redirect(`/app/teams/${data.id}/squad`);
}

export async function updateTeam(teamId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(teamId).success) return NOT_FOUND;
  const raw = teamValues(fd);
  const parsed = teamSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .update({ name: parsed.data.name, match_format: parsed.data.matchFormat, primary_color: parsed.data.primaryColor })
    .eq("id", teamId)
    .select("id");
  if (error) return { status: "error", message: "Couldn't save changes. Try again.", values: raw };
  if (!data.length) return NOT_FOUND;

  revalidatePath(`/app/teams/${teamId}`, "layout");
  revalidatePath("/app/teams");
  return { status: "success", message: "Team details saved." };
}

export async function deleteTeam(teamId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(teamId).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle();
  if (!team) return NOT_FOUND;
  if (String(fd.get("confirmName") ?? "").trim() !== team.name) {
    return { status: "error", fieldErrors: { confirmName: ["Type the team name exactly to confirm."] } };
  }
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error || !data.length) return { status: "error", message: "Couldn't delete the team. Try again." };

  revalidatePath("/app/teams");
  redirect("/app/teams");
}

// --- Players (TEAM-02) ------------------------------------------------------

export async function addPlayer(teamId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(teamId).success) return NOT_FOUND;
  const raw = playerValues(fd);
  const parsed = playerSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { error } = await supabase.from("players").insert({
    team_id: teamId,
    name: parsed.data.name,
    shirt_number: parsed.data.shirtNumber,
    preferred_positions: parsed.data.preferredPositions,
  });
  // RLS rejects inserts into teams the caller doesn't own (42501).
  if (error) return error.code === "42501" ? NOT_FOUND : { status: "error", message: "Couldn't add the player. Try again.", values: raw };

  revalidatePath(`/app/teams/${teamId}`, "layout");
  return { status: "success", message: `${parsed.data.name} added to the squad.` };
}

export async function updatePlayer(playerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(playerId).success) return NOT_FOUND;
  const raw = playerValues(fd);
  const parsed = playerSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update({
      name: parsed.data.name,
      shirt_number: parsed.data.shirtNumber,
      preferred_positions: parsed.data.preferredPositions,
    })
    .eq("id", playerId)
    .select("team_id");
  if (error) return { status: "error", message: "Couldn't save the player. Try again.", values: raw };
  if (!data.length) return NOT_FOUND;

  revalidatePath(`/app/teams/${data[0].team_id}`, "layout");
  return { status: "success", message: "Player saved." };
}

export async function setPlayerArchived(playerId: string, archived: boolean): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(playerId).success) return NOT_FOUND;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", playerId)
    .select("team_id, name");
  if (error) return { status: "error", message: "Couldn't update the player. Try again." };
  if (!data.length) return NOT_FOUND;

  revalidatePath(`/app/teams/${data[0].team_id}`, "layout");
  return { status: "success", message: archived ? `${data[0].name} archived.` : `${data[0].name} restored.` };
}
