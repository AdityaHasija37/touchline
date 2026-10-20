import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Privacy · Touchline" };

/** Plain-language privacy notice (PLAN-004 §8). Describes what the code actually does. */
export default function PrivacyPage() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/" className="rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <Logo />
      </Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-muted-foreground">How Touchline handles your team&apos;s information, in plain language.</p>

      <div className="mt-8 grid gap-6 text-[15px] leading-relaxed [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>What we store</h2>
          <ul>
            <li>Your account: email address, an optional display name and a securely hashed password.</li>
            <li>What you enter: team names and colours, player names, shirt numbers and positions, tactics boards, fixtures, lineups and match plans, including private notes.</li>
            <li>Published briefings: a frozen copy of the parts of a plan you chose to share.</li>
          </ul>
        </section>
        <section>
          <h2>Who can see it</h2>
          <ul>
            <li>Everything in your account is private to you. Other users can&apos;t see or change it.</li>
            <li>A published briefing can be opened by anyone who has its link. It shows only the sections you included, the lineup (with any roles and instructions you add), set-piece jobs, the sub plan and the match details. It never shows private notes, your full squad list or your account details.</li>
            <li>You can revoke a link at any time. After that it shows &ldquo;briefing unavailable&rdquo;.</li>
            <li>Share links are never stored in readable form. We keep only a one-way fingerprint of each link.</li>
          </ul>
        </section>
        <section>
          <h2>Usage statistics</h2>
          <p>
            We count a few actions, such as a briefing being published, viewed or exported, to see whether Touchline is useful. These records use a
            random id per team and contain only counts and formats, never names, notes, email addresses, links or diagrams. They can&apos;t be linked
            back to a team once it&apos;s deleted. There are no advertising or third-party tracking cookies. The only cookie keeps you signed in.
          </p>
        </section>
        <section>
          <h2>Where it lives</h2>
          <p>Data is stored in a managed Postgres database with sign-in provided by Supabase. The app is hosted on Vercel. Both act as our processors.</p>
        </section>
        <section>
          <h2>Deleting things</h2>
          <ul>
            <li>Deleting a team permanently removes its squad, tactics, fixtures, plans and any shared links.</li>
            <li>Archiving a player hides them from new lineups but keeps them in past briefings.</li>
            <li>
              To delete your whole account, {contact ? <a href={`mailto:${contact}`} className="text-primary underline">email us</a> : "contact the team that runs this site"}. Self-service account deletion isn&apos;t built yet.
            </li>
          </ul>
        </section>
        <p className="text-sm text-muted-foreground">This is an early product. This notice describes how the software works today and will be updated if that changes.</p>
      </div>
    </div>
  );
}
