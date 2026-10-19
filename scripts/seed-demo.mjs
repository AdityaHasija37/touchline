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
    await admin.auth.admin.deleteUser(existing.id);
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
const { error: tErr } = await admin.from("tactics").insert({
  team_id: team.id,
  name: "2-3-1 base shape",
  category: "shape",
  format: 7,
  board_json: { schemaVersion: 1, format: 7, orientation: "vertical", objects },
});
if (tErr) throw tErr;

await admin.from("teams").insert([
  { owner_id: ownerId, name: "Rovers Five-a-side", match_format: 5, primary_color: "#1d4ed8" },
  { owner_id: ownerId, name: "Rovers Vets XI", match_format: 11, primary_color: "#111827" },
]);

console.log(`Seeded ${DEMO_EMAIL} with 3 teams; Sunday Rovers has ${squad.length} players and 1 tactic.`);
