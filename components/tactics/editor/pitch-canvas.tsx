"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Arc, Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { PITCH_COLORS } from "@/components/board/board-svg";
import { fitPitch, PITCH_WIDTH_M, roundPoint } from "@/lib/domain/pitch";
import { markerFill } from "@/lib/domain/colors";
import { PITCH_MARKINGS } from "@/lib/domain/pitch-markings";
import type { BoardObject } from "@/lib/validation/board";
import { useEditor } from "./context";

/**
 * Konva rendering of the board. Everything is drawn in a "vertical local" space of size
 * (vw × vh) px; horizontal orientation just rotates that group 90°, so drag positions read
 * back in local space map straight to pitch coordinates for either orientation.
 */
export default function PitchCanvas({ teamColor }: { teamColor: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const board = useEditor((s) => s.board);
  const selectedId = useEditor((s) => s.selectedId);
  const dispatch = useEditor((s) => s.dispatch);
  const select = useEditor((s) => s.select);

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

  const toPitch = (node: Konva.Node) => roundPoint({ x: (node.x() / vw) * 100, y: (node.y() / vh) * 100 });
  const clampNode = (node: Konva.Node) => {
    node.x(Math.max(0, Math.min(vw, node.x())));
    node.y(Math.max(0, Math.min(vh, node.y())));
  };

  const draggable = (o: BoardObject) => ({
    draggable: true,
    onMouseDown: () => select(o.id),
    onTouchStart: () => select(o.id),
    onDragStart: () => select(o.id),
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => clampNode(e.target),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      dispatch({ type: "move", id: o.id, to: toPitch(e.target) });
    },
  });

  return (
    <div
      ref={wrap}
      className="absolute inset-0"
      data-testid="pitch-stage"
      data-pitch={JSON.stringify({ x: originX, y: fit.offsetY, vw, vh, orientation: board.orientation })}
    >
      {box.width > 0 && (
        <Stage
          width={box.width}
          height={box.height}
          onMouseDown={(e) => e.target === e.target.getStage() && select(null)}
          onTouchStart={(e) => e.target === e.target.getStage() && select(null)}
        >
          <Layer>
            <Rect width={box.width} height={box.height} fill="#2f6e46" onMouseDown={() => select(null)} />
            <Group x={originX} y={fit.offsetY} rotation={vertical ? 0 : 90}>
              <Rect width={vw} height={vh} fill={PITCH_COLORS.grass} onMouseDown={() => select(null)} onTouchStart={() => select(null)} />
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

              {board.objects.map((o) => {
                const selected = o.id === selectedId;
                switch (o.kind) {
                  case "zone":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...draggable(o)}>
                        <Rect width={px(o.w)} height={py(o.h)} fill={o.color} opacity={0.3} stroke={selected ? "#facc15" : o.color} strokeWidth={selected ? 3 : 1} />
                      </Group>
                    );
                  case "arrow":
                  case "line":
                    return (
                      <Group key={o.id} x={px(o.from.x)} y={py(o.from.y)} {...draggable(o)}>
                        <Arrow
                          points={[0, 0, px(o.to.x) - px(o.from.x), py(o.to.y) - py(o.from.y)]}
                          stroke={selected ? "#facc15" : "white"}
                          fill={selected ? "#facc15" : "white"}
                          strokeWidth={3}
                          hitStrokeWidth={16}
                          pointerLength={o.kind === "arrow" ? 10 : 0}
                          pointerWidth={o.kind === "arrow" ? 10 : 0}
                          dash={o.kind === "arrow" && o.style === "run" ? [10, 6] : o.kind === "arrow" && o.style === "dribble" ? [2, 6] : undefined}
                        />
                      </Group>
                    );
                  case "text":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...draggable(o)}>
                        <Text text={o.text} fill={selected ? "#facc15" : "white"} fontStyle="bold" fontSize={14} rotation={labelRotation} />
                      </Group>
                    );
                  case "ball":
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...draggable(o)}>
                        {selected && <Circle radius={r * 0.55 + 5} stroke="#facc15" strokeWidth={3} />}
                        <Circle radius={r * 0.5} fill="white" stroke="#111827" strokeWidth={2} />
                      </Group>
                    );
                  case "player": {
                    const home = o.team === "home";
                    return (
                      <Group key={o.id} x={px(o.x)} y={py(o.y)} {...draggable(o)}>
                        {selected && <Circle radius={r + 5} stroke="#facc15" strokeWidth={3} />}
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
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}
