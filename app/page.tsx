export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Touchline</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Your match plan, from squad list to team talk.
      </h1>
      <p className="text-lg text-muted-foreground">
        Build a lineup, draw the shape, and hand your players a briefing they can open on their phones.
      </p>
      <p className="text-sm text-muted-foreground">Sign-in arrives in Phase 1.</p>
    </main>
  );
}
