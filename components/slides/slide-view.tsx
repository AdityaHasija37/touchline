import { BoardSvg } from "@/components/board/board-svg";
import type { MatchFormat } from "@/lib/domain/format";
import { lineupBoard } from "@/lib/domain/lineup-board";
import type { SlideSpec } from "@/lib/domain/slides";
import { cn } from "@/lib/utils";

/**
 * Renders one SlideSpec. The same component is used by the owner presenter, the public
 * briefing and (Phase 6) the PDF. Sizes use container-query units so a slide reads the same at
 * 1280×720 and on a phone; on narrow screens it reflows into a single column.
 */
export function SlideView({
  slide,
  teamColor,
  format = 11,
  me,
  focusable = false,
  className,
}: {
  /** In the viewer a slide may scroll on small screens, so it must be reachable by keyboard. */
  focusable?: boolean;
  slide: SlideSpec;
  teamColor: string;
  format?: MatchFormat;
  /** "Find me": the viewer's player key; their marker and rows are highlighted. */
  me?: string;
  className?: string;
}) {
  return (
    <div
      tabIndex={focusable ? 0 : undefined}
      className={cn("@container h-full w-full overflow-y-auto bg-white text-zinc-900 focus-visible:outline-3 focus-visible:outline-emerald-400", className)}
    >
      <div className="flex min-h-full flex-col p-[5cqw] @2xl:p-[4cqw]">{body(slide, teamColor, format, me)}</div>
    </div>
  );
}

function Heading({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-[3cqw] @2xl:mb-[2cqw]">
      {eyebrow && <p className="mb-1 text-[3.6cqw] font-semibold tracking-wide text-emerald-700 uppercase @2xl:text-[1.5cqw]">{eyebrow}</p>}
      <h2 className="text-[8cqw] leading-tight font-bold tracking-tight text-balance @2xl:text-[3.6cqw]">{children}</h2>
    </header>
  );
}

function body(slide: SlideSpec, teamColor: string, format: MatchFormat, me?: string) {
  switch (slide.kind) {
    case "title":
      return (
        <div className="flex flex-1 flex-col justify-center gap-[3cqw] @2xl:gap-[1.6cqw]">
          <p className="flex items-center gap-2 text-[4.2cqw] font-semibold @2xl:text-[1.8cqw]">
            <span aria-hidden className="inline-block size-[3.4cqw] rounded @2xl:size-[1.5cqw]" style={{ backgroundColor: teamColor }} />
            {slide.teamName} · {slide.format}v{slide.format}
          </p>
          <h1 className="text-[12cqw] leading-none font-bold tracking-tight text-balance @2xl:text-[6.5cqw]">{slide.title}</h1>
          <p className="text-[5cqw] text-zinc-600 @2xl:text-[2.4cqw]">{slide.subtitle}</p>
          {slide.venue && <p className="text-[4.4cqw] text-zinc-600 @2xl:text-[2cqw]">{slide.venue}</p>}
          {slide.objective && (
            <div className="mt-[2cqw] rounded-xl border-l-[1.4cqw] border-emerald-600 bg-emerald-50 px-[4cqw] py-[3cqw] @2xl:mt-[1cqw] @2xl:border-l-[0.5cqw] @2xl:px-[2cqw] @2xl:py-[1.4cqw]">
              <p className="text-[3.4cqw] font-semibold tracking-wide text-emerald-800 uppercase @2xl:text-[1.3cqw]">Objective</p>
              <p className="text-[5.4cqw] font-semibold text-balance @2xl:text-[2.6cqw]">{slide.objective}</p>
            </div>
          )}
        </div>
      );
    case "lineup": {
      const pitch = lineupBoard(slide.starters, format);
      return (
        <>
          <Heading eyebrow={slide.formation}>{slide.title}</Heading>
          <div
            className={cn(
              "grid flex-1 grid-cols-[minmax(0,1fr)] gap-[4cqw] @2xl:gap-[3cqw]",
              pitch ? "@2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "@2xl:grid-cols-[2fr_1fr]",
            )}
          >
            {pitch && (
              <div className="mx-auto w-full max-w-[70cqw] @2xl:max-w-none">
                <div className="mx-auto overflow-hidden rounded-xl @2xl:max-h-[38cqw] @2xl:w-auto" style={{ aspectRatio: "74 / 111" }}>
                  <BoardSvg
                    board={pitch.board}
                    captions={pitch.captions}
                    highlight={me ? [me] : undefined}
                    teamColor={teamColor}
                    title={`${slide.formation ?? "Lineup"} on the pitch`}
                    className="h-full w-full"
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-[3cqw] @2xl:gap-[1.6cqw]">
              <ol
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)] content-start gap-[1.6cqw] @2xl:grid-cols-2 @2xl:gap-x-[2cqw] @2xl:gap-y-[0.3cqw]",
                  !pitch && "@2xl:gap-x-[2.5cqw]",
                )}
                aria-label="Starters"
              >
                {slide.starters.map((p, i) => (
                  <li
                    key={p.key ?? i}
                    data-me={me && p.key === me ? "" : undefined}
                    className={cn(
                      "flex items-center gap-[2.4cqw] border-b border-zinc-200 py-[1.4cqw] @2xl:gap-[1cqw] @2xl:py-[0.35cqw]",
                      me && p.key === me && "rounded-md bg-yellow-100",
                    )}
                  >
                    <span
                      className="flex size-[9cqw] shrink-0 items-center justify-center rounded-full text-[4.4cqw] font-bold text-white @2xl:size-[2.6cqw] @2xl:text-[1.2cqw]"
                      style={{ backgroundColor: teamColor }}
                    >
                      {p.number ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[5cqw] font-semibold @2xl:text-[1.5cqw]">{p.name}</span>
                      {(p.role || p.instruction) && (
                        <span className="block truncate text-[3.6cqw] text-zinc-600 @2xl:text-[1.05cqw]">
                          {[p.role, p.instruction].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {p.position && <span className="shrink-0 text-[4cqw] font-semibold text-zinc-500 @2xl:text-[1.2cqw]">{p.position}</span>}
                  </li>
                ))}
              </ol>
              {slide.bench.length > 0 && (
                <section aria-label="Bench">
                  <h3 className="mb-[1.4cqw] text-[3.8cqw] font-semibold tracking-wide text-zinc-500 uppercase @2xl:mb-[0.6cqw] @2xl:text-[1.3cqw]">Bench</h3>
                  <ul className="grid gap-[1cqw] @2xl:flex @2xl:flex-wrap @2xl:gap-x-[2cqw] @2xl:gap-y-[0.3cqw]">
                    {slide.bench.map((p, i) => (
                      <li key={p.key ?? i} className={cn("text-[4.6cqw] @2xl:text-[1.4cqw]", me && p.key === me && "rounded-md bg-yellow-100 font-semibold")}>
                        <span className="inline-block w-[8cqw] font-semibold text-zinc-500 tabular-nums @2xl:w-auto @2xl:pr-[0.6cqw]">{p.number ?? "–"}</span>
                        {p.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      );
    }
    case "setpieces":
      return (
        <>
          <Heading>{slide.title}</Heading>
          <div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-[4cqw] @2xl:grid-cols-2 @2xl:gap-[3cqw]">
            {slide.jobs.length > 0 && (
              <dl className="grid content-start gap-[1.6cqw] @2xl:gap-[0.6cqw]" aria-label="Takers">
                {slide.jobs.map((j) => (
                  <div
                    key={j.job}
                    className={cn(
                      "flex items-baseline justify-between gap-[2cqw] border-b border-zinc-200 py-[1.2cqw] @2xl:py-[0.5cqw]",
                      me && j.key === me && "rounded-md bg-yellow-100",
                    )}
                  >
                    <dt className="text-[4.2cqw] font-semibold text-zinc-500 @2xl:text-[1.6cqw]">{j.label}</dt>
                    <dd className="truncate text-[5cqw] font-semibold @2xl:text-[2cqw]">{j.name}</dd>
                  </div>
                ))}
              </dl>
            )}
            {slide.marking.length > 0 && (
              <section aria-label="Marking at set pieces">
                <h3 className="mb-[1.4cqw] text-[3.8cqw] font-semibold tracking-wide text-zinc-500 uppercase @2xl:mb-[0.6cqw] @2xl:text-[1.3cqw]">Marking</h3>
                <ul className="grid gap-[1.2cqw] @2xl:gap-[0.5cqw]">
                  {slide.marking.map((m, i) => (
                    <li key={i} className={cn("text-[4.6cqw] @2xl:text-[1.8cqw]", me && m.key === me && "rounded-md bg-yellow-100")}>
                      <span className="font-semibold">{m.name}</span> <span className="text-zinc-500">→</span> {m.target}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      );
    case "subs":
      return (
        <>
          <Heading eyebrow={`${slide.matchLength} minutes`}>{slide.title}</Heading>
          <div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-[4cqw] @2xl:grid-cols-2 @2xl:gap-[3cqw]">
            <ol className="grid content-start gap-[1.6cqw] @2xl:gap-[0.6cqw]" aria-label="Substitutions">
              {slide.subs.map((x, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-baseline gap-[2.4cqw] border-b border-zinc-200 py-[1.2cqw] text-[4.6cqw] @2xl:gap-[1.2cqw] @2xl:py-[0.5cqw] @2xl:text-[1.8cqw]",
                    me && (x.inKey === me || x.outKey === me) && "rounded-md bg-yellow-100",
                  )}
                >
                  <span className="w-[10cqw] shrink-0 font-bold tabular-nums @2xl:w-[4cqw]">{x.minute}&prime;</span>
                  <span className="min-w-0">
                    <span className="font-semibold text-emerald-700">On</span> {x.inName} <span className="font-semibold text-zinc-500">· off</span> {x.outName}
                  </span>
                </li>
              ))}
            </ol>
            <section aria-label="Planned minutes">
              <h3 className="mb-[1.4cqw] text-[3.8cqw] font-semibold tracking-wide text-zinc-500 uppercase @2xl:mb-[0.6cqw] @2xl:text-[1.3cqw]">
                Planned minutes
              </h3>
              <ul className="grid gap-[1.2cqw] @2xl:gap-[0.45cqw]">
                {slide.minutes.map((m) => (
                  <li
                    key={m.key}
                    className={cn("grid grid-cols-[1fr_auto] items-center gap-x-[2cqw] text-[4cqw] @2xl:text-[1.4cqw]", me && m.key === me && "font-semibold")}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="tabular-nums">{m.minutes}&prime;</span>
                    <span aria-hidden className="col-span-2 h-[1.2cqw] overflow-hidden rounded-full bg-zinc-100 @2xl:h-[0.5cqw]">
                      <span
                        className={cn("block h-full rounded-full", m.short ? "bg-amber-500" : "bg-emerald-600")}
                        style={{
                          width: `${(m.minutes / slide.matchLength) * 100}%`,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      );
    case "board":
      return (
        <div className="grid flex-1 gap-[4cqw] @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @2xl:items-center @2xl:gap-[3cqw]">
          <div className="order-2 mx-auto w-full max-w-[70cqw] @2xl:order-1 @2xl:max-w-none">
            {slide.board ? (
              <div
                className="mx-auto overflow-hidden rounded-xl @2xl:max-h-[46cqw] @2xl:w-auto"
                style={{
                  aspectRatio: slide.board.orientation === "vertical" ? "68 / 105" : "105 / 68",
                }}
              >
                <BoardSvg
                  board={slide.board}
                  teamColor={teamColor}
                  title={slide.title}
                  highlight={me ? Object.entries(slide.markerRefs ?? {}).flatMap(([id, k]) => (k === me ? [id] : [])) : undefined}
                  className="h-full w-full"
                />
              </div>
            ) : (
              <p className="text-zinc-500">No board</p>
            )}
          </div>
          <div className="order-1 @2xl:order-2">
            <Heading eyebrow={slide.phase}>{slide.title}</Heading>
            {slide.notes && <p className="text-[4.8cqw] leading-snug whitespace-pre-line @2xl:text-[2.1cqw]">{slide.notes}</p>}
          </div>
        </div>
      );
    case "notes":
      return (
        <>
          <Heading eyebrow={slide.phase}>{slide.title}</Heading>
          <p className="max-w-[90cqw] text-[5cqw] leading-snug whitespace-pre-line @2xl:max-w-[70cqw] @2xl:text-[2.4cqw]">{slide.body || "—"}</p>
        </>
      );
    case "reminders":
      return (
        <>
          <Heading>{slide.title}</Heading>
          <ul className="grid gap-[2.4cqw] @2xl:gap-[1.4cqw]">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex gap-[2.4cqw] text-[5.6cqw] font-semibold @2xl:gap-[1.2cqw] @2xl:text-[2.8cqw]">
                <span aria-hidden className="text-emerald-600">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </>
      );
  }
}

export function slideLabel(slide: SlideSpec): string {
  return slide.kind === "title" ? "Match" : slide.title;
}
