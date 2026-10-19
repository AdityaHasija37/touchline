"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BoardSvg } from "@/components/board/board-svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteSection, moveSection, updateSection } from "@/app/(app)/app/matches/actions";
import type { PlanSection } from "@/lib/db/matches";
import type { MatchFormat } from "@/lib/domain/format";
import { PHASES, PHASE_LABELS, type Phase } from "@/lib/validation/match";

const TYPE_LABEL = { board: "Tactic board", notes: "Notes", reminders: "Final reminders" } as const;
const inputCls =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SectionCard({
  section,
  index,
  count,
  format,
  teamColor,
}: {
  section: PlanSection;
  index: number;
  count: number;
  format: MatchFormat;
  teamColor: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [include, setInclude] = useState(section.includeInBriefing);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const id = section.id;

  const persist = async (next: { title?: string; content?: typeof content; include?: boolean }) => {
    const data = { title: next.title ?? title, content: next.content ?? content, includeInBriefing: next.include ?? include };
    setStatus("saving");
    const res = await updateSection(id, data).catch(() => ({ status: "error" as const, message: "Couldn't reach the server." }));
    if (res.status === "saved") {
      setStatus("saved");
      if (next.include !== undefined) router.refresh(); // readiness depends on inclusion
    } else {
      setStatus("error");
      toast.error(res.message);
    }
  };
  const act = (fn: () => Promise<{ status: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.status === "error") toast.error(res.message ?? "Something went wrong.");
      router.refresh();
    });

  const mismatch = section.tactic && section.tactic.format !== format;

  return (
    <article aria-labelledby={`sec-${id}-title`} className="rounded-2xl border bg-card p-4" data-testid="plan-section">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums" aria-hidden>
          {index + 1}
        </span>
        <Badge variant="secondary">{TYPE_LABEL[section.type]}</Badge>
        {!include && <Badge variant="outline">Not in briefing</Badge>}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : ""}
        </span>
        <div className="flex gap-0.5">
          <Button size="icon-xs" variant="ghost" aria-label={`Move “${title}” up`} disabled={index === 0 || pending} onClick={() => act(() => moveSection(id, -1))}>
            <ChevronUp />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label={`Move “${title}” down`} disabled={index === count - 1 || pending} onClick={() => act(() => moveSection(id, 1))}>
            <ChevronDown />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label={`Remove “${title}”`} disabled={pending} onClick={() => act(() => deleteSection(id))}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <div className="grid gap-1.5">
          <Label htmlFor={`sec-${id}-title`}>Title</Label>
          <input
            id={`sec-${id}-title`}
            className={inputCls}
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (!title.trim()) return setTitle(section.title);
              if (title !== section.title) void persist({ title });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sec-${id}-phase`}>Phase</Label>
          <select
            id={`sec-${id}-phase`}
            className={inputCls}
            value={content.phase}
            onChange={(e) => {
              const next = { ...content, phase: e.target.value as Phase };
              setContent(next);
              void persist({ content: next });
            }}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {section.type === "board" && (
        <div className="mt-3 flex gap-3">
          <div className="w-24 shrink-0 overflow-hidden rounded-lg">
            {section.tactic?.board ? (
              <BoardSvg board={section.tactic.board} teamColor={teamColor} title={section.tactic.name} />
            ) : (
              <div className="flex aspect-[68/105] items-center justify-center bg-muted p-2 text-center text-xs text-muted-foreground">No tactic</div>
            )}
          </div>
          <div className="min-w-0 text-sm">
            {section.tactic ? (
              <>
                <p className="truncate font-medium">{section.tactic.name}</p>
                <Link href={`/app/tactics/${section.tactic.id}`} className="text-primary underline-offset-4 hover:underline">
                  Edit tactic
                </Link>
                {mismatch && (
                  <p className="mt-1 text-xs text-amber-700">
                    This is a {section.tactic.format}v{section.tactic.format} board; the match is {format}v{format}.
                  </p>
                )}
              </>
            ) : (
              <p className="text-destructive">The attached tactic was deleted. Remove this section or add a new board.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-1.5">
        <Label htmlFor={`sec-${id}-notes`}>{section.type === "reminders" ? "Reminders for players" : "Coaching notes for players"}</Label>
        <Textarea
          id={`sec-${id}-notes`}
          rows={3}
          maxLength={2000}
          value={content.notes}
          placeholder={section.type === "reminders" ? "One per line, e.g. Talk early. Win the first header." : "What players need to know for this part of the game."}
          onChange={(e) => setContent({ ...content, notes: e.target.value })}
          onBlur={() => content.notes !== section.content.notes && void persist({})}
        />
      </div>

      <details className="mt-3 rounded-lg border border-dashed px-3 py-2" open={Boolean(content.privateNotes)}>
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium">
          <Lock className="size-3.5" aria-hidden /> Private note (never shared)
        </summary>
        <Label htmlFor={`sec-${id}-private`} className="sr-only">
          Private note for “{title}”
        </Label>
        <Textarea
          id={`sec-${id}-private`}
          className="mt-2"
          rows={2}
          maxLength={2000}
          value={content.privateNotes}
          placeholder="Only you see this. It's never included in a published briefing."
          onChange={(e) => setContent({ ...content, privateNotes: e.target.value })}
          onBlur={() => content.privateNotes !== section.content.privateNotes && void persist({})}
        />
      </details>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={include}
          onChange={(e) => {
            setInclude(e.target.checked);
            void persist({ include: e.target.checked });
          }}
          className="size-4 accent-primary"
        />
        Include in players&apos; briefing
      </label>
    </article>
  );
}
