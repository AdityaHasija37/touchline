import { PITCH_LENGTH_M as L, PITCH_WIDTH_M as W } from "@/lib/domain/pitch";
import { markerFill } from "@/lib/domain/colors";
import { wrapText } from "@/lib/domain/text-wrap";
import { PITCH_MARKINGS, arcPath } from "@/lib/domain/pitch-markings";
import type { Board, BoardObject } from "@/lib/validation/board";
import { cn } from "@/lib/utils";

/**
 * Deterministic SVG rendering of a board (TECH-003 §7). Used for thumbnails now, and by the
 * presenter and PDF export later, so there's one drawing of a board everywhere outside the editor.
 */
export const PITCH_COLORS = { grass: "#3f8f5a", stripe: "#3a8653", line: "rgba(255,255,255,0.9)", away: "#f8fafc", ball: "#ffffff" };

const mx = (x: number) => (x / 100) * W;
const my = (y: number) => (y / 100) * L;

export function BoardSvg({
  board,
  teamColor = "#111827",
  title,
  className,
  showLabels = true,
  decorative = false,
}: {
  /** Hide from assistive tech when a surrounding control already names it. */
  decorative?: boolean;
  board: Board;
  teamColor?: string;
  title?: string;
  className?: string;
  showLabels?: boolean;
}) {
  const vertical = board.orientation === "vertical";
  const pad = 3;
  const vb = vertical ? `${-pad} ${-pad} ${W + pad * 2} ${L + pad * 2}` : `${-pad} ${-pad} ${L + pad * 2} ${W + pad * 2}`;
  // Horizontal: rotate the vertical drawing 90° clockwise so our goal sits on the left.
  const transform = vertical ? undefined : `translate(${L} 0) rotate(90)`;
  const counter = (x: number, y: number) => (vertical ? undefined : `rotate(-90 ${x} ${y})`);
  const fill = markerFill(teamColor);
  const ordered = [...board.objects].sort((a, b) => zIndex(a) - zIndex(b));

  return (
    <svg
      viewBox={vb}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : (title ?? "Tactics board")}
      className={cn("block h-auto w-full", className)}
    >
      {title && !decorative && <title>{title}</title>}
      <defs>
        <marker id="tl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="white" />
        </marker>
      </defs>
      <rect x={-pad} y={-pad} width="100%" height="100%" fill={PITCH_COLORS.grass} />
      <g transform={transform}>
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={0} y={(i * L) / 7} width={W} height={L / 14} fill={PITCH_COLORS.stripe} />
        ))}
        <g fill="none" stroke={PITCH_COLORS.line} strokeWidth={0.35}>
          {PITCH_MARKINGS.map((m, i) => {
            switch (m.type) {
              case "rect":
                return <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} />;
              case "line":
                return <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />;
              case "circle":
                return <circle key={i} cx={m.cx} cy={m.cy} r={m.r} />;
              case "dot":
                return <circle key={i} cx={m.cx} cy={m.cy} r={m.r} fill={PITCH_COLORS.line} />;
              case "arc":
                return <path key={i} d={arcPath(m)} />;
            }
          })}
        </g>
        {ordered.map((o) => (
          <BoardObjectSvg key={o.id} o={o} teamColor={fill} showLabels={showLabels} counter={counter} />
        ))}
      </g>
    </svg>
  );
}

function zIndex(o: BoardObject) {
  return { zone: 0, line: 1, arrow: 2, text: 3, player: 4, ball: 5 }[o.kind];
}

function BoardObjectSvg({
  o,
  teamColor,
  showLabels,
  counter,
}: {
  o: BoardObject;
  teamColor: string;
  showLabels: boolean;
  counter: (x: number, y: number) => string | undefined;
}) {
  switch (o.kind) {
    case "zone":
      return (
        <g>
          <rect x={mx(o.x)} y={my(o.y)} width={mx(o.w)} height={my(o.h)} fill={o.color} fillOpacity={0.28} stroke={o.color} strokeWidth={0.3} />
          {o.label && showLabels && (
            <text x={mx(o.x) + 1} y={my(o.y) + 3} fontSize={2.4} fill="white" fontWeight={600} transform={counter(mx(o.x) + 1, my(o.y) + 3)}>
              {o.label}
            </text>
          )}
        </g>
      );
    case "line":
      return <line x1={mx(o.from.x)} y1={my(o.from.y)} x2={mx(o.to.x)} y2={my(o.to.y)} stroke="white" strokeWidth={0.5} />;
    case "arrow":
      return (
        <line
          x1={mx(o.from.x)}
          y1={my(o.from.y)}
          x2={mx(o.to.x)}
          y2={my(o.to.y)}
          stroke="white"
          strokeWidth={0.5}
          strokeDasharray={o.style === "run" ? "1.6 1" : o.style === "dribble" ? "0.4 0.8" : undefined}
          strokeLinecap="round"
          markerEnd="url(#tl-arrow)"
        />
      );
    case "text":
      return (
        <text x={mx(o.x)} y={my(o.y)} fontSize={2.6} fill="white" fontWeight={600} textAnchor="middle" transform={counter(mx(o.x), my(o.y))}>
          {wrapText(o.text).map((line, i) => (
            <tspan key={i} x={mx(o.x)} dy={i === 0 ? "0.9em" : "1.15em"}>
              {line}
            </tspan>
          ))}
        </text>
      );
    case "ball":
      return <circle cx={mx(o.x)} cy={my(o.y)} r={1.1} fill={PITCH_COLORS.ball} stroke="#111827" strokeWidth={0.3} />;
    case "player": {
      const home = o.team === "home";
      const cx = mx(o.x), cy = my(o.y);
      return (
        <g>
          <circle cx={cx} cy={cy} r={2.6} fill={home ? teamColor : PITCH_COLORS.away} stroke={home ? "white" : "#111827"} strokeWidth={0.45} />
          {showLabels && o.label && (
            <text
              x={cx}
              y={cy}
              dy="0.35em"
              fontSize={o.label.length > 2 ? 1.7 : 2.2}
              fontWeight={700}
              textAnchor="middle"
              fill={home ? "white" : "#111827"}
              transform={counter(cx, cy)}
            >
              {o.label}
            </text>
          )}
        </g>
      );
    }
  }
}
