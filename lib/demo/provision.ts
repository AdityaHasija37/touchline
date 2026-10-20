import "server-only";
import { randomBytes } from "node:crypto";
import { createDemoProvisioningClient } from "@/lib/supabase/admin";
import { clientKey } from "@/lib/share/token";
import { applyOp } from "@/lib/domain/board-ops";
import { boardFromFormation } from "@/lib/domain/formations";
import { zonedTimeToUtc } from "@/lib/domain/time";
import type { PlayerMarker } from "@/lib/validation/board";

export function demoEnabled(): boolean {
  return process.env.DEMO_ENABLED !== "false";
}

const SQUAD: [name: string, number: number, positions: string[]][] = [
  ["Sam Okafor", 1, ["GK"]],
  ["Alex Moreno", 2, ["DEF"]],
  ["Jo Lindqvist", 4, ["DEF"]],
  ["Riley Chen", 5, ["DEF", "MID"]],
  ["Max Adeyemi", 8, ["MID"]],
  ["Kai Brennan", 10, ["MID", "FWD"]],
  ["Lee Novak", 9, ["FWD"]],
  ["Dani Ruiz", 14, ["MID"]],
  ["Toni Walsh", 17, ["FWD"]],
];

/** Next Saturday's date in London, as YYYY-MM-DD. */
function nextSaturday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Creates a private, pre-filled sandbox account (DEC-48): a 7v7 team, squad, an annotated tactic
 * and a fixture whose plan is one click from publishing. Returns credentials for an immediate
 * sign-in; they're never shown to anyone. Sandboxes are deleted after 24 hours.
 */
export async function provisionDemo(ip: string): Promise<{ status: "ok"; email: string; password: string } | { status: "busy" }> {
  const db = createDemoProvisioningClient();
  const { data: allowed } = await db.rpc("claim_demo_slot", { p_client_hash: clientKey(ip) });
  if (!allowed) return { status: "busy" };
  await db.rpc("cleanup_demo_accounts"); // opportunistic expiry, no cron needed

  const email = `demo-${randomBytes(6).toString("hex")}@demo.touchline.invalid`;
  const password = randomBytes(24).toString("base64url");
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Demo Captain", demo: true },
  });
  if (error || !created.user) return { status: "busy" };
  const owner = created.user.id;
  await db.from("demo_accounts").insert({ user_id: owner });

  try {
    const { data: team } = await db.from("teams").insert({ owner_id: owner, name: "Sunday Rovers", match_format: 7, primary_color: "#2f7d4f" }).select("id").single();
    const teamId = team!.id;
    const { data: players } = await db
      .from("players")
      .insert(SQUAD.map(([name, shirt_number, preferred_positions]) => ({ team_id: teamId, name, shirt_number, preferred_positions })))
      .select("id, name, shirt_number");
    const byName = new Map(players!.map((p) => [p.name, p]));

    // A 2-3-1 shape linked to the squad, with a pressing zone, runs and a note.
    let board = boardFromFormation(7, "7-231");
    const order = ["Sam Okafor", "Alex Moreno", "Jo Lindqvist", "Riley Chen", "Max Adeyemi", "Lee Novak", "Kai Brennan"];
    board.objects.filter((o): o is PlayerMarker => o.kind === "player").forEach((m, i) => {
      const p = byName.get(order[i])!;
      board = applyOp(board, { type: "assign", id: m.id, playerId: p.id, label: String(p.shirt_number) });
    });
    board = applyOp(board, { type: "add-zone", a: { x: 8, y: 8 }, b: { x: 44, y: 30 } });
    board = applyOp(board, { type: "update-zone", id: board.objects.at(-1)!.id, label: "Press trap" });
    board = applyOp(board, { type: "add-arrow", from: { x: 18, y: 52 }, to: { x: 14, y: 22 }, style: "run" });
    board = applyOp(board, { type: "add-arrow", from: { x: 50, y: 54 }, to: { x: 20, y: 46 }, style: "pass" });
    board = applyOp(board, { type: "add-text", at: { x: 70, y: 84 }, text: "Keeper starts every build-up" });
    const { data: tactic } = await db.from("tactics").insert({ team_id: teamId, name: "2-3-1 press", category: "defending", format: 7, board_json: board }).select("id").single();

    const { data: match } = await db
      .from("matches")
      .insert({
        team_id: teamId,
        opponent_name: "Riverside Dynamos",
        kickoff_at: zonedTimeToUtc(nextSaturday(), "14:00", "Europe/London").toISOString(),
        kickoff_tz: "Europe/London",
        venue: "Hackney Marshes, pitch 7",
        match_format: 7,
      })
      .select("id")
      .single();
    const { data: plan } = await db.from("match_plans").insert({ match_id: match!.id, objective: "Win the second balls in midfield" }).select("id").single();
    const positions = ["GK", "LB", "RB", "LM", "CM", "ST", "RM"];
    await db.from("lineup_assignments").insert([
      ...order.map((n, i) => ({ plan_id: plan!.id, player_id: byName.get(n)!.id, role: "starter", formation_slot: i + 1, position_label: positions[i] })),
      ...["Dani Ruiz", "Toni Walsh"].map((n) => ({ plan_id: plan!.id, player_id: byName.get(n)!.id, role: "bench" })),
    ]);
    await db.from("plan_sections").insert([
      {
        plan_id: plan!.id,
        section_type: "board",
        title: "Our press",
        tactic_id: tactic!.id,
        sort_order: 0,
        content_json: { phase: "out_of_possession", notes: "Show them inside, then trap on the touchline. 5 and 9 tuck in when they have it wide.", privateNotes: "Riley comes off at half time if booked. Players never see this." },
      },
      {
        plan_id: plan!.id,
        section_type: "notes",
        title: "Set pieces",
        sort_order: 1,
        content_json: { phase: "set_pieces", notes: "Near-post run from 4 on every corner. Kai takes free kicks inside 25 yards.", privateNotes: "" },
      },
      {
        plan_id: plan!.id,
        section_type: "reminders",
        title: "Final reminders",
        sort_order: 2,
        content_json: { phase: "general", notes: "Talk early.\nWin the first header.\nShake hands after, whatever the score.", privateNotes: "" },
      },
    ]);
  } catch {
    // An empty sandbox is still usable; the visitor can build from scratch.
  }
  return { status: "ok", email, password };
}
