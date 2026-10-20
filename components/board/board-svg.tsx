import { renderBoard, type Prim, type RenderOpts } from "@/lib/domain/board-render";
import type { Board } from "@/lib/validation/board";
import { cn } from "@/lib/utils";

export { PITCH_COLORS } from "@/lib/domain/board-render";

/**
 * Screen SVG of a board, drawn from the same primitives as the PDF (lib/domain/board-render.ts),
 * so thumbnails, slides and exported pages always match.
 */
export function BoardSvg({
  board,
  teamColor = "#111827",
  title,
  className,
  showLabels = true,
  decorative = false,
  captions,
  highlight,
}: Pick<RenderOpts, "captions" | "highlight"> & {
  /** Hide from assistive tech when a surrounding control already names it. */
  decorative?: boolean;
  board: Board;
  teamColor?: string;
  title?: string;
  className?: string;
  showLabels?: boolean;
}) {
  const { width, height, prims } = renderBoard(board, teamColor, { showLabels, captions, highlight });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (title ?? "Tactics board")}
      className={cn("block h-auto w-full", className)}
    >
      {title && !decorative && <title>{title}</title>}
      {prims.map((p, i) => (
        <PrimSvg key={i} p={p} />
      ))}
    </svg>
  );
}

function PrimSvg({ p }: { p: Prim }) {
  switch (p.t) {
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} fillOpacity={p.fillOpacity} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "line":
      return (
        <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash?.join(" ")} strokeLinecap={p.round ? "round" : undefined} />
      );
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "path":
      return <path d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "text":
      return (
        <text x={p.x} y={p.y} fontSize={p.size} fontWeight={p.bold ? 700 : 400} fill={p.fill} textAnchor={p.anchor}>
          {p.text}
        </text>
      );
  }
}
