// Seeds a LOCAL demo account with a 7v7 team and squad. Refuses to run against non-local Supabase.
// Usage: node scripts/seed-demo.mjs
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url ?? "")) throw new Error("seed-demo only runs against local Supabase");

export const DEMO_EMAIL = "demo@touchline.test";
export const DEMO_PASSWORD = "touchline-demo-7v7"; // local test account only

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: list } = await admin.auth.admin.listUsers();
const existing = list.users.find((u) => u.email === DEMO_EMAIL);
if (existing) await admin.auth.admin.deleteUser(existing.id);

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

await admin.from("teams").insert([
  { owner_id: ownerId, name: "Rovers Five-a-side", match_format: 5, primary_color: "#1d4ed8" },
  { owner_id: ownerId, name: "Rovers Vets XI", match_format: 11, primary_color: "#111827" },
]);

console.log(`Seeded ${DEMO_EMAIL} with 3 teams; Sunday Rovers has ${squad.length} players.`);
