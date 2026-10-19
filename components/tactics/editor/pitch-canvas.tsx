"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Arc, Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { PITCH_COLORS } from "@/components/board/board-svg";
import { markerFill } from "@/lib/domain/colors";
import { MIN_SEGMENT, MIN_ZONE } from "@/lib/domain/board-ops";
import { clamp, fitPitch, PITCH_WIDTH_M, roundPoint, type PitchPoint } from "@/lib/domain/pitch";
import { PITCH_MARKINGS } from "@/lib/domain/pitch-markings";
import { wrapText } from "@/lib/domain/text-wrap";
import type { BoardObject } from "@/lib/validation/board";
import { useEditor } from "./context";

const SELECT = "#facc15";
type Draft = { kind: "arrow" | "line" | "zone"; a: PitchPoint; b: PitchPoint };
type HandleDrag = { id: string; handle: string; at: PitchPoint };

/**
 * Konva rendering of the board. Everything is drawn in a "vertical local" space of size
 * (vw × vh) px; horizontal orientation just rotates that group 90°, so positions read back in
 * local space (drags, getRelativePointerPosition) map straight to pitch coordinates either way.
 */
export default function PitchCanvas({ teamColor }: { teamColor: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<Konva.Group>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [handleDrag, setHandleDrag] = useState<HandleDrag | null>(null);
  const board = useEditor((s) => s.board);
  const selectedId = useEditor((s) => s.selectedId);
  const tool = useEditor((s) => s.tool);
  const arrowStyle = useEditor((s) => s.arrowStyle);
  const pendingText = useEditor((s) => s.pendingText);
  const dispatch = useEditor((s) => s.dispatch);
  const select = useEditor((s) => s.select);
  const placeText = useEditor((s) => s.placeText);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(([e]) => setBox({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vertical = board.orientation === "vertical";
  const fit = fitPitch(box, board.orientation, 20);
  const vw = vertical ? fit.width : fit.height;
  const vh = vertical ? fit.height : fit.width;
  const m = vw / PITCH_WIDTH_M; // px per metre
  const px = (x: number) => (x / 100) * vw;
  const py = (y: number) => (y / 100) * vh;
  const r = Math.max(11, Math.min(20, 2.6 * m));
  const fill = markerFill(teamColor);
  const labelRotation = vertical ? 0 : -90;
  const originX = vertical ? fit.offsetX : fit.offsetX + fit.width;
  const drawing = tool === "arrow" || tool === "line" || tool === "zone";
  const interactive = tool === "select" || tool === "erase";

  const nodeToPitch = (node: Konva.Node) => roundPoint({ x: clamp((node.x() / vw) * 100), y: clamp((node.y() / vh) * 100) });
  const pointer = (): PitchPoint | null => {
    const p = pitchRef.current?.getRelativePointerPosition();
    return p ? roundPoint({ x: clamp((p.x / vw) * 100), y: clamp((p.y / vh) * 100) }) : null;
  };
  const clampNode = (node: Konva.Node) => {
    node.x(Math.max(0, Math.min(vw, node.x())));
    node.y(Math.max(0, Math.min(vh, node.y())));
  };

  // --- Stage-level pointer handling for draw / text tools ----------------------------------
  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const p = pointer();
    if (drawing && p) {
      setDraft({ kind: tool, a: p, b: p });
      return;
    }
    if (tool === "text" && p) {
      placeText(p);
      return;
    }
    if (tool === "select" && (e.target === e.target.getStage() || e.target.name() === "background")) select(null);
  };
  const onMove = () => {
    if (!draft) return;
    const p = pointer();
    if (p) setDraft({ ...draft, b: p });
  };
  const onUp = () => {
    if (!draft) return;
    const { kind, a, b } = draft;
    setDraft(null);
    const longEnough = kind === "zone" ? Math.abs(a.x - b.x) >= MIN_ZONE && Math.abs(a.y - b.y) >= MIN_ZONE : Math.hypot(a.x - b.x, a.y - b.y) >= MIN_SEGMENT;
    if (!longEnough) return; // a click, not a drag
    if (kind === "arrow") dispatch({ type: "add-arrow", from: a, to: b, style: arrowStyle });
    else if (kind === "line") dispatch({ type: "add-line", from: a, to: b });
    else dispatch({ type: "add-zone", a, b });
  };

  const objectProps = (o: BoardObject) => ({
    listening: interactive,
    draggable: tool === "select",
    onMouseDown: () => tool === "select" && select(o.id),
    onTouchStart: () => tool === "select" && select(o.id),
    onClick: () => tool === "erase" && dispatch({ type: "remove", id: o.id }),
    onTap: () => tool === "erase" && dispatch({ type: "remove", id: o.id }),
    onDragStart: () => select(o.id),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => clampNode(e.target),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => dispatch({ type: "move", id: o.id, to: nodeToPitch(e.target) }),
  });

  // Live geometry while a handle is dragged; committed as one op (one undo step) on release.
  const live = (o: BoardObject): BoardObject => {
    if (!handleDrag || handleDrag.id !== o.id) return o;
    const at = handleDrag.at;
    if ((o.kind === "arrow" || o.kind === "line") && (handleDrag.handle === "from" || handleDrag.handle === "to")) return { ...o, [handleDrag.handle]: at };
    if (o.kind === "zone") {
      const opp = oppositeCorner(o, handleDrag.handle);
      return { ...o, x: Math.min(opp.x, at.x), y: Math.min(opp.y, at.y), w: Math.abs(opp.x - at.x), h: Math.abs(opp.y - at.y) };
    }
    return o;
  };

  const handle = (o: BoardObject, name: string, p: PitchPoint) => (
    <Circle
      key={name}
      name={`handle-${name}`}
      x={px(p.x)}
      y={py(p.y)}
      radius={7}
      fill="white"
      stroke={SELECT}
      strokeWidth={3}
      draggable
      onMouseDown={(e) => (e.cancelBubble = true)}
      onDragMove={(e) => {
        clampNode(e.target);
        setHandleDrag({ id: o.id, handle: name, at: nodeToPitch(e.target) });
      }}
      onDragEnd={(e) => {
        const at = nodeToPitch(e.target);
        setHandleDrag(null);
        if (o.kind === "zone") dispatch({ type: "set-zone-rect", id: o.id, a: oppositeCorner(o, name), b: at });
        else dispatch({ type: "set-endpoint", id: o.id, end: name as "from" | "to", to: at });
      }}
    />
  );

  const selected = board.objects.find((o) => o.id === selectedId);
  const selectedLive = selected ? live(selected) : null;
  const cursor = drawing || tool === "text" ? "crosshair" : tool === "erase" ? "cell" : "default";

  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      style={{ cursor }}
      data-testid="pitch-stage"
      data-pitch={JSON.stringify({ x: originX, y: fit.offsetY, vw, vh, orientation: board.orientation })}
    >
      {box.width > 0 && (
        <Stage width={box.width} height={box.height} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <Layer>
            <Rect name="background" width={box.width} height={box.height} fill="#2f6e46" />
            <Group ref={pitchRef} x={originX} y={fit.offsetY} rotation={vertical ? 0 : 90}>
              <Rect name="background" width={vw} height={vh} fill={PITCH_COLORS.grass} />
              {Array.from({ length: 7 }, (_, i) => (
                <Rect key={i} y={(i * vh) / 7} width={vw} height={vh / 14} fill={PITCH_COLORS.stripe} listening={false} />
              ))}
              <Group listening={false} scaleX={m} scaleY={m}>
                {PITCH_MARKINGS.map((k, i) => {
                  const common = { stroke: PITCH_COLORS.line, strokeWidth: 0.35 };
                  switch (k.type) {
                    case "rect":
                      return <Rect key={i} x={k.x} y={k.y} width={k.w} height={k.h} {...common} />;
                    case "line":
                      return <Line key={i} points={[k.x1, k.y1, k.x2, k.y2]} {...common} />;
                    case "circle":
                      return <Circle key={i} x={k.cx} y={k.cy} radius={k.r} {...common} />;
                    case "dot":
                      return <Circle key={i} x={k.cx} y={k.cy} radius={k.r} fill={PITCH_COLORS.line} />;
                    case "arc":
                      return <Arc key={i} x={k.cx} y={k.cy} innerRadius={k.r} outerRadius={k.r} angle={k.sweepDeg} rotation={k.startDeg} {...common} />;
                  }
                })}
              </Group>

              {[...board.objects].sort((a, b) => zIndex(a) - zIndex(b)).map((raw) => {
                const o = live(raw);
                const isSel = o.id === selectedId;
                switch (o.kind) {
                  case "zone":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...objectProps(raw)}>
                        <Rect width={px(o.w)} height={py(o.h)} fill={o.color} opacity={0.28} />
                        <Rect width={px(o.w)} height={py(o.h)} stroke={isSel ? SELECT : o.color} strokeWidth={isSel ? 3 : 1.5} dash={isSel ? [8, 4] : undefined} />
                        {o.label && <Text text={o.label} x={6} y={6} fill="white" fontStyle="bold" fontSize={13} rotation={labelRotation} listening={false} />}
                      </Group>
                    );
                  case "arrow":
                  case "line":
                    return (
                      <Group key={o.id} x={px(o.from.x)} y={py(o.from.y)} {...objectProps(raw)}>
                        <Arrow
                          points={[0, 0, px(o.to.x) - px(o.from.x), py(o.to.y) - py(o.from.y)]}
                          stroke={isSel ? SELECT : "white"}
                          fill={isSel ? SELECT : "white"}
                          strokeWidth={3}
                          hitStrokeWidth={18}
                          lineCap="round"
                          pointerLength={o.kind === "arrow" ? 11 : 0}
                          pointerWidth={o.kind === "arrow" ? 11 : 0}
                          dash={o.kind === "arrow" && o.style === "run" ? [10, 6] : o.kind === "arrow" && o.style === "dribble" ? [2, 6] : undefined}
                        />
                      </Group>
                    );
                  case "text":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...objectProps(raw)}>
                        <Text
                          text={wrapText(o.text).join("\n")}
                          wrap="none"
                          width={220}
                          offsetX={110}
                          lineHeight={1.15}
                          align="center"
                          fill={isSel ? SELECT : "white"}
                          fontStyle="bold"
                          fontSize={14}
                          rotation={labelRotation}
                          shadowColor="black"
                          shadowBlur={3}
                          shadowOpacity={0.4}
                        />
                      </Group>
                    );
                  case "ball":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...objectProps(raw)}>
                        {isSel && <Circle radius={r * 0.55 + 5} stroke={SELECT} strokeWidth={3} />}
                        <Circle radius={r * 0.5} fill="white" stroke="#111827" strokeWidth={2} />
                      </Group>
                    );
                  case "player": {
                    const home = o.team === "home";
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...objectProps(raw)}>
                        {isSel && <Circle radius={r + 5} stroke={SELECT} strokeWidth={3} />}
                        <Circle
                          radius={r}
                          fill={home ? fill : PITCH_COLORS.away}
                          stroke={home ? "white" : "#111827"}
                          strokeWidth={2}
                          shadowColor="black"
                          shadowBlur={4}
                          shadowOpacity={0.25}
                        />
                        <Text
                          text={o.label}
                          width={r * 2}
                          height={r * 2}
                          offsetX={r}
                          offsetY={r}
                          align="center"
                          verticalAlign="middle"
                          fontStyle="bold"
                          fontSize={o.label.length > 2 ? r * 0.7 : r * 0.9}
                          fill={home ? "white" : "#111827"}
                          rotation={labelRotation}
                          listening={false}
                        />
                      </Group>
                    );
                  }
                }
              })}

              {/* Edit handles for the selected arrow/line/zone */}
              {tool === "select" && selectedLive && (selectedLive.kind === "arrow" || selectedLive.kind === "line") && (
                <>{[handle(selected!, "from", selectedLive.from), handle(selected!, "to", selectedLive.to)]}</>
              )}
              {tool === "select" && selectedLive?.kind === "zone" && (
                <>
                  {corners(selectedLive).map(([name, p]) => handle(selected!, name, p))}
                </>
              )}

              {/* In-progress drawing */}
              {draft && draft.kind === "zone" && (
                <Rect
                  x={px(Math.min(draft.a.x, draft.b.x))}
                  y={py(Math.min(draft.a.y, draft.b.y))}
                  width={px(Math.abs(draft.a.x - draft.b.x))}
                  height={py(Math.abs(draft.a.y - draft.b.y))}
                  fill="#facc15"
                  opacity={0.25}
                  stroke={SELECT}
                  dash={[6, 4]}
                  listening={false}
                />
              )}
              {draft && draft.kind !== "zone" && (
                <Arrow
                  points={[px(draft.a.x), py(draft.a.y), px(draft.b.x), py(draft.b.y)]}
                  stroke={SELECT}
                  fill={SELECT}
                  strokeWidth={3}
                  pointerLength={draft.kind === "arrow" ? 11 : 0}
                  pointerWidth={draft.kind === "arrow" ? 11 : 0}
                  dash={draft.kind === "arrow" && arrowStyle === "run" ? [10, 6] : draft.kind === "arrow" && arrowStyle === "dribble" ? [2, 6] : undefined}
                  listening={false}
                />
              )}
              {pendingText && (
                <Group x={px(pendingText.x)} y={py(pendingText.y)} listening={false}>
                  <Rect x={-60} y={-4} width={120} height={24} stroke={SELECT} dash={[4, 3]} rotation={labelRotation} />
                  <Text text="Type in the panel →" width={120} offsetX={60} align="center" fill="white" fontSize={12} rotation={labelRotation} />
                </Group>
              )}
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function zIndex(o: BoardObject) {
  return { zone: 0, line: 1, arrow: 2, text: 3, player: 4, ball: 5 }[o.kind];
}

type Zone = Extract<BoardObject, { kind: "zone" }>;

function corners(z: Zone): [string, PitchPoint][] {
  return [
    ["nw", { x: z.x, y: z.y }],
    ["ne", { x: z.x + z.w, y: z.y }],
    ["sw", { x: z.x, y: z.y + z.h }],
    ["se", { x: z.x + z.w, y: z.y + z.h }],
  ];
}

function oppositeCorner(z: Zone, handle: string): PitchPoint {
  const opposite: Record<string, string> = { nw: "se", ne: "sw", sw: "ne", se: "nw" };
  return Object.fromEntries(corners(z))[opposite[handle]];
}
