import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { TeamForm } from "@/components/teams/team-form";
import { createTeam } from "../actions";

export const metadata: Metadata = { title: "New team · Touchline" };

export default function NewTeamPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/app/teams" className="hover:underline">Your teams</Link>}
        title="Create a team"
        description="You can change any of this later."
      />
      <div className="rounded-2xl border bg-card p-5 sm:p-8">
        <TeamForm action={createTeam} submitLabel="Create team" pendingLabel="Creating…" />
      </div>
    </>
  );
}
