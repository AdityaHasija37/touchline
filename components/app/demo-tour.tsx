import Link from "next/link";
import { Sparkles } from "lucide-react";

/** A short guided path through the product for demo visitors (recruiters, curious captains). */
export function DemoTour({ teamId, matchId }: { teamId: string; matchId?: string }) {
  const plan = matchId ? `/app/matches/${matchId}/plan` : `/app/teams/${teamId}/matches`;
  const steps = [
    { href: `/app/teams/${teamId}/squad`, label: "Look at the squad", hint: "9 players with numbers and positions" },
    { href: `/app/teams/${teamId}/tactics`, label: "Open the tactics board", hint: "drag players, draw a run, undo it" },
    { href: plan, label: "Open Saturday's match plan", hint: "lineup, sections, private notes" },
    { href: plan, label: "Preview & publish, then open the player link", hint: "what players see on their phones" },
  ];
  return (
    <section aria-labelledby="tour-heading" className="mb-8 rounded-2xl border border-primary/30 bg-accent p-5">
      <h2 id="tour-heading" className="flex items-center gap-2 font-semibold text-accent-foreground">
        <Sparkles className="size-4" aria-hidden /> A two-minute tour
      </h2>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link href={s.href} className="block rounded-lg bg-background px-3 py-2 text-sm hover:ring-2 hover:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="font-medium">
                {i + 1}. {s.label}
              </span>
              <span className="block text-muted-foreground">{s.hint}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
