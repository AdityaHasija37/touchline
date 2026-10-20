"use client";

import { useEffect, useRef, useState } from "react";
import type { SlideSpec } from "@/lib/domain/slides";
import { SlideView } from "./slide-view";

const W = 1280;
const H = 720;

/** A slide exactly as presented at 1280×720, scaled to fit, so previews never use the phone layout. */
export function SlideThumb({ slide, teamColor }: { slide: SlideSpec; teamColor: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden" aria-hidden>
      {scale > 0 && (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <SlideView slide={slide} teamColor={teamColor} className="overflow-hidden" />
        </div>
      )}
    </div>
  );
}
