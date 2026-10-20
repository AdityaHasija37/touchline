"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoEnabled, provisionDemo } from "@/lib/demo/provision";

/** "Try the demo": create a private sandbox and sign straight into it (no email, no sign-up). */
export async function startDemo() {
  if (!demoEnabled()) redirect("/register");
  const h = await headers();
  const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = await provisionDemo(ip);
  if (result.status !== "ok") redirect("/?demo=busy");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: result.email, password: result.password });
  if (error) redirect("/?demo=busy");
  redirect("/app/teams?welcome=demo");
}
