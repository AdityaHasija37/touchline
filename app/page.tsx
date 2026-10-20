import Image from "next/image";
import Link from "next/link";
import { ClipboardList, LayoutTemplate, Link2, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { demoEnabled } from "@/lib/demo/provision";
import { startDemo } from "./demo/actions";

const STEPS = [
  { icon: Users, title: "Squad", body: "Add your players once. Numbers, positions, and who's available." },
  { icon: LayoutTemplate, title: "Shape", body: "Start from a 5, 7 or 11-a-side formation. Drag players, draw runs, mark zones." },
  { icon: ClipboardList, title: "Plan", body: "Pick the lineup for Saturday, attach your boards, add notes that only you can see." },
  { icon: Link2, title: "Briefing", body: "Publish a frozen briefing. Players open a private link on their phones, or you print the PDF." },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const { demo } = await searchParams;
  const showDemo = demoEnabled();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:pt-16">
          <div className="grid gap-6">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">For grassroots captains and coaches</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Your match plan, from squad list to team talk.</h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Most Sunday-league plans live in a group chat, a whiteboard photo and the captain&apos;s head. Touchline keeps the squad, the shape and the
              plan in one place, and turns it into a briefing your players can actually open.
            </p>
            {demo === "busy" && (
              <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The demo is busy right now. Please try again in a few minutes.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {showDemo && (
                <form action={startDemo}>
                  <SubmitButton size="lg" pendingLabel="Setting up your demo team…">
                    Try the demo, no sign-up
                  </SubmitButton>
                </form>
              )}
              <Link href="/register" className={buttonVariants({ size: "lg", variant: showDemo ? "outline" : "default" })}>
                Create your team
              </Link>
            </div>
            {showDemo && <p className="text-sm text-muted-foreground">The demo is a private sandbox with a ready-made 7v7 team. It deletes itself after 24 hours.</p>}
          </div>
          <div className="relative">
            <Image
              src="/landing/editor.jpg"
              alt="The tactics editor: a 7v7 pitch with players, a pressing zone, runs and a note, next to an inspector panel"
              width={1600}
              height={1075}
              priority
              className="rounded-xl border shadow-xl"
            />
            <Image
              src="/landing/phone.jpg"
              alt="A player's phone showing the starting lineup slide"
              width={739}
              height={1600}
              className="absolute -bottom-8 -left-4 hidden w-32 rounded-xl border-4 border-zinc-900 shadow-2xl sm:block lg:-left-10 lg:w-40"
            />
          </div>
        </section>

        <section aria-labelledby="how-heading" className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-2 text-primary">
                    <s.icon className="size-5" aria-hidden />
                    <span className="text-sm font-semibold">
                      {i + 1}. {s.title}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <figure className="grid content-start gap-3">
            <Image src="/landing/plan.jpg" alt="The match plan screen with lineup, ordered briefing sections and a publishing checklist" width={1600} height={1493} className="rounded-xl border shadow-sm" />
            <figcaption className="text-sm text-muted-foreground">
              The plan won&apos;t publish until the lineup is complete, and private notes never leave your screen.
            </figcaption>
          </figure>
          <figure className="grid content-start gap-3">
            <Image src="/landing/briefing.jpg" alt="A published briefing slide showing the tactic board and coaching notes" width={1600} height={900} className="rounded-xl border shadow-sm" />
            <figcaption className="text-sm text-muted-foreground">
              Players get a read-only briefing: no app, no account. You can switch the link off at any time.
            </figcaption>
          </figure>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
            <ShieldCheck className="size-8 shrink-0 text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Private by default. Your squad and plans are visible only to you. Shared briefings show only what you choose, and links are stored as
              one-way fingerprints, never in readable form.{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-4">
                How we handle data
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>Touchline is an early product built as a portfolio project.</span>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
