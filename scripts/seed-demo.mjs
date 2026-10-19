// Seeds a LOCAL demo account with a 7v7 team and squad. Refuses to run against non-local Supabase.
// Usage: node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url ?? "")) throw new Error("seed-demo only runs against local Supabase");

export const DEMO_EMAIL = "demo@touchline.test";
export const DEMO_PASSWORD = "touchline-demo-7v7"; // local test account only

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// listUsers is paginated; walk every page so re-seeding works after many test users exist.
for (let page = 1; ; page++) {
  const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (listErr) throw listErr;
  const existing = data.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    const { error: delErr } = await admin.auth.admin.deleteUser(existing.id);
    if (delErr) throw delErr;
    break;
  }
  if (data.users.length < 200) break;
}

const { data: created, error } = await admin.auth.admin.createUser({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  email_confirm: true,
  user_metadata: { display_name: "Demo Captain" },
});
if (error) throw error;
const ownerId = created.user.id;

const { data: team, error: teamErr } = await admin
  .from("teams")
  .insert({ owner_id: ownerId, name: "Sunday Rovers", match_format: 7, primary_color: "#2f7d4f" })
  .select("id")
  .single();
if (teamErr) throw teamErr;

const squad = [
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
const { error: pErr } = await admin.from("players").insert(
  squad.map(([name, shirt_number, preferred_positions]) => ({ team_id: team.id, name, shirt_number, preferred_positions })),
);
if (pErr) throw pErr;

const { data: roster } = await admin.from("players").select("id, name, shirt_number").eq("team_id", team.id).order("shirt_number");
const slots = [["GK", 50, 92], ["LB", 32, 74], ["RB", 68, 74], ["LM", 18, 52], ["CM", 50, 54], ["RM", 82, 52], ["ST", 50, 28]];
const objects = slots.map(([, x, y], i) => ({ id: `p-seed${i}`, kind: "player", playerId: roster[i].id, team: "home", label: String(roster[i].shirt_number), x, y }));
objects.push({ id: "ball-seed", kind: "ball", x: 50, y: 50 });
objects.push(
  { id: "zone-seed", kind: "zone", x: 8, y: 8, w: 36, h: 22, color: "#facc15", label: "Press trap" },
  { id: "arrow-seed1", kind: "arrow", from: { x: 18, y: 52 }, to: { x: 14, y: 22 }, style: "run" },
  { id: "arrow-seed2", kind: "arrow", from: { x: 50, y: 54 }, to: { x: 20, y: 46 }, style: "pass" },
  { id: "arrow-seed3", kind: "arrow", from: { x: 50, y: 28 }, to: { x: 32, y: 18 }, style: "dribble" },
  { id: "text-seed", kind: "text", x: 70, y: 84, text: "Keeper starts every build-up" },
);
const { data: tactic, error: tErr } = await admin.from("tactics").insert({
  team_id: team.id,
  name: "2-3-1 base shape",
  category: "shape",
  format: 7,
  board_json: { schemaVersion: 1, format: 7, orientation: "vertical", objects },
}).select("id").single();
if (tErr) throw tErr;

// Next Saturday at 14:00 London time (stored as UTC by the same rule the app uses).
const sat = new Date();
sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
const day = sat.toISOString().slice(0, 10);
const londonOffset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
  .formatToParts(new Date(`${day}T12:00:00Z`)).find((p) => p.type === "timeZoneName").value; // "GMT" or "GMT+1"
const hours = londonOffset === "GMT" ? 14 : 13;
const { data: match, error: mErr } = await admin.from("matches").insert({
  team_id: team.id, opponent_name: "Riverside Dynamos", kickoff_at: `${day}T${String(hours).padStart(2, "0")}:00:00Z`,
  kickoff_tz: "Europe/London", venue: "Hackney Marshes, pitch 7", match_format: 7,
}).select("id").single();
if (mErr) throw mErr;
const { data: plan } = await admin.from("match_plans").insert({ match_id: match.id, objective: "Win the second balls in midfield" }).select("id").single();
// Six of seven starters picked: shows the publish checklist blocking (QA-05).
const positions = ["GK", "LB", "RB", "LM", "CM", "RM"];
await admin.from("lineup_assignments").insert([
  ...roster.slice(0, 6).map((r, i) => ({ plan_id: plan.id, player_id: r.id, role: "starter", formation_slot: i + 1, position_label: positions[i] })),
  ...roster.slice(7, 9).map((r) => ({ plan_id: plan.id, player_id: r.id, role: "bench" })),
]);
await admin.from("plan_sections").insert([
  { plan_id: plan.id, section_type: "board", title: "Our shape", tactic_id: tactic.id, sort_order: 0,
    content_json: { phase: "out_of_possession", notes: "Stay compact. 5 and 9 tuck in when they have it wide.", privateNotes: "Riley gets subbed at half time if booked." } },
  { plan_id: plan.id, section_type: "reminders", title: "Final reminders", sort_order: 1,
    content_json: { phase: "general", notes: "Talk early.\nWin the first header.\nShake hands after, whatever the score.", privateNotes: "" } },
]);

await admin.from("teams").insert([
  { owner_id: ownerId, name: "Rovers Five-a-side", match_format: 5, primary_color: "#1d4ed8" },
  { owner_id: ownerId, name: "Rovers Vets XI", match_format: 11, primary_color: "#111827" },
]);

console.log(`Seeded ${DEMO_EMAIL} with 3 teams; Sunday Rovers has ${squad.length} players, 1 tactic and a fixture.`);
