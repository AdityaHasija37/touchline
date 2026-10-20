"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import type { SlideSpec } from "@/lib/domain/slides";
import { cn } from "@/lib/utils";
import { SlideView, slideLabel } from "./slide-view";

/**
 * Matchday viewer (UX-002 S09/S10): dark chrome, match label top-left, slide number top-right,
 * navigation at the bottom; keyboard, touch swipe and a jump list. No editing controls.
 */
export function Viewer({
  slides,
  teamColor,
  matchLabel,
  banner,
  exitHref,
}: {
  slides: SlideSpec[];
  teamColor: string;
  matchLabel: string;
  banner?: React.ReactNode;
  exitHref?: string;
}) {
  const [index, setIndex] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = slides.length - 1;
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(last, i + 1));
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(last);
    };
    const onFull = () => setIsFull(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [last]);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  };

  const slide = slides[index];

  return (
    <div ref={root} className="flex h-dvh flex-col bg-zinc-950 text-zinc-100" data-testid="viewer">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-300">{matchLabel}</p>
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-sm text-zinc-400 tabular-nums" data-testid="slide-counter">
            {index + 1} / {slides.length}
          </p>
          <button
            type="button"
            onClick={toggleFull}
            className="hidden rounded-md p-1.5 text-zinc-300 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none sm:inline-flex"
            aria-label={isFull ? "Exit full screen" : "Full screen"}
          >
            {isFull ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
          {exitHref && (
            <a href={exitHref} className="rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none">
              Exit
            </a>
          )}
        </div>
      </header>
      {banner}

      <main
        className="flex min-h-0 flex-1 items-center justify-center px-2 [container-type:size] sm:px-6"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <section
          aria-roledescription="slide"
          aria-label={`Slide ${index + 1} of ${slides.length}: ${slideLabel(slide)}`}
          className="h-full w-full overflow-hidden rounded-lg shadow-2xl md:aspect-video md:h-auto md:w-[min(100cqw,calc(100cqh*16/9))]"
        >
          <SlideView key={slide.id} slide={slide} teamColor={teamColor} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200" />
        </section>
        <p className="sr-only" aria-live="polite">
          Slide {index + 1} of {slides.length}: {slideLabel(slide)}
        </p>
      </main>

      <nav aria-label="Slides" className="flex items-center justify-center gap-2 px-4 py-3">
        <NavButton label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft className="size-5" />
        </NavButton>
        <label htmlFor="jump" className="sr-only">
          Jump to slide
        </label>
        <select
          id="jump"
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          className="h-9 max-w-[55vw] rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
        >
          {slides.map((s, i) => (
            <option key={s.id} value={i}>
              {i + 1}. {slideLabel(s)}
            </option>
          ))}
        </select>
        <NavButton label="Next slide" disabled={index === last} onClick={() => go(index + 1)}>
          <ChevronRight className="size-5" />
        </NavButton>
      </nav>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 transition hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none",
        disabled && "opacity-40",
      )}
    >
      {children}
    </button>
  );
}
