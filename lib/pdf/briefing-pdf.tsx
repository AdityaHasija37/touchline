import "server-only";
import path from "node:path";
import { Circle, Document, Font, Line, Page, Path, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { renderBoard, type Prim } from "@/lib/domain/board-render";
import { buildSlides, type SlideSpec } from "@/lib/domain/slides";
import type { Snapshot } from "@/lib/domain/snapshot";

/**
 * Printable briefing (EXP-01). Consumes the published snapshot through the same SlideSpec and
 * board primitives as the presenter, so page order and diagrams match the screen exactly.
 */
const PAGE = { width: 842, height: 595 }; // A4 landscape, points

// Embedded Unicode font: the built-in PDF fonts only cover basic Western characters, so names
// like "Łukasz Żółć" or Cyrillic/Greek ones would lose letters. Noto Sans, SIL OFL 1.1 (assets/fonts/OFL.txt).
const FONT = "Noto Sans";
const fontDir = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: FONT,
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// Don't hyphenate names and short notes.
Font.registerHyphenationCallback((word) => [word]);
const INK = "#18181b";
const MUTED = "#52525b";
const ACCENT = "#047857";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: FONT, color: INK, fontSize: 14 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  h1: { fontSize: 44, fontWeight: 700, marginBottom: 10 },
  h2: { fontSize: 28, fontWeight: 700, marginBottom: 14 },
  sub: { fontSize: 18, color: MUTED, marginBottom: 6 },
  body: { fontSize: 16, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: MUTED },
});

export function BriefingPdf({ snapshot }: { snapshot: Snapshot }) {
  const slides = buildSlides(snapshot);
  const color = snapshot.team.color;
  return (
    <Document title={`${snapshot.team.name} vs ${snapshot.match.opponent}`} author="Touchline" creator="Touchline" producer="Touchline">
      {slides.map((slide, i) => (
        <Page key={slide.id} size={[PAGE.width, PAGE.height]} style={s.page}>
          <SlidePage slide={slide} teamColor={color} />
          <View style={s.footer} fixed>
            <Text>
              {snapshot.team.name} vs {snapshot.match.opponent} · {snapshot.match.kickoffLabel}
            </Text>
            <Text>
              {i + 1} / {slides.length}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

function SlidePage({ slide, teamColor }: { slide: SlideSpec; teamColor: string }) {
  switch (slide.kind) {
    case "title":
      return (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: teamColor, marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: 700 }}>
              {slide.teamName} · {slide.format}v{slide.format}
            </Text>
          </View>
          <Text style={s.h1}>{slide.title}</Text>
          <Text style={s.sub}>{slide.subtitle}</Text>
          {slide.venue && <Text style={s.sub}>{slide.venue}</Text>}
          {slide.objective && (
            <View style={{ marginTop: 18, borderLeftWidth: 5, borderLeftColor: "#059669", backgroundColor: "#ecfdf5", padding: 14 }}>
              <Text style={s.eyebrow}>Objective</Text>
              <Text style={{ fontSize: 22, fontWeight: 700 }}>{slide.objective}</Text>
            </View>
          )}
        </View>
      );
    case "lineup":
      return (
        <View>
          <Text style={s.h2}>{slide.title}</Text>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 2, flexDirection: "row", flexWrap: "wrap" }}>
              {slide.starters.map((p, i) => (
                <View key={i} style={{ width: "50%", flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingRight: 16, borderBottomWidth: 0.5, borderBottomColor: "#d4d4d8" }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: teamColor, justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: 700 }}>{p.number ?? "-"}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{p.name}</Text>
                  {p.position && <Text style={{ fontSize: 12, color: MUTED, fontWeight: 700 }}>{p.position}</Text>}
                </View>
              ))}
            </View>
            {slide.bench.length > 0 && (
              <View style={{ flex: 1, paddingLeft: 24 }}>
                <Text style={{ ...s.eyebrow, color: MUTED }}>Bench</Text>
                {slide.bench.map((p, i) => (
                  <Text key={i} style={{ fontSize: 14, marginBottom: 4 }}>
                    {p.number ?? "-"}  {p.name}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    case "board": {
      const vertical = slide.board?.orientation !== "horizontal";
      return (
        <View style={{ flexDirection: vertical ? "row" : "column", flex: 1 }}>
          <View style={vertical ? { width: 300, marginRight: 30 } : { marginBottom: 14 }}>
            {slide.board && <BoardPdf board={slide.board} teamColor={teamColor} width={vertical ? 300 : 560} />}
          </View>
          <View style={{ flex: 1, justifyContent: vertical ? "center" : "flex-start" }}>
            <Text style={s.eyebrow}>{slide.phase}</Text>
            <Text style={s.h2}>{slide.title}</Text>
            {slide.notes ? <Text style={s.body}>{slide.notes}</Text> : null}
          </View>
        </View>
      );
    }
    case "notes":
      return (
        <View>
          <Text style={s.eyebrow}>{slide.phase}</Text>
          <Text style={s.h2}>{slide.title}</Text>
          <Text style={{ ...s.body, fontSize: 18 }}>{slide.body || "-"}</Text>
        </View>
      );
    case "reminders":
      return (
        <View>
          <Text style={s.h2}>{slide.title}</Text>
          {slide.bullets.map((b, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 10 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 10, marginTop: 4 }}>
                <Path d="M4 12.5 L9.5 18 L20 6" stroke="#059669" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{b}</Text>
            </View>
          ))}
        </View>
      );
  }
}

/** Same primitives as the screen SVG, drawn with react-pdf's SVG elements. */
function BoardPdf({ board, teamColor, width }: { board: NonNullable<Extract<SlideSpec, { kind: "board" }>["board"]>; teamColor: string; width: number }) {
  const r = renderBoard(board, teamColor);
  const height = (width * r.height) / r.width;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${r.width} ${r.height}`}>
      {r.prims.map((p, i) => (
        <PrimPdf key={i} p={p} />
      ))}
    </Svg>
  );
}

function PrimPdf({ p }: { p: Prim }) {
  switch (p.t) {
    case "rect":
      return <Rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} fillOpacity={p.fillOpacity} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "line":
      return (
        <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash?.join(" ")} strokeLinecap={p.round ? "round" : undefined} />
      );
    case "circle":
      return <Circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "path":
      return <Path d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.strokeWidth} />;
    case "text":
      return (
        <Text x={p.x} y={p.y} fill={p.fill} textAnchor={p.anchor} style={{ fontSize: p.size, fontFamily: FONT, fontWeight: p.bold ? 700 : 400 }}>
          {p.text}
        </Text>
      );
  }
}

// Renders run one at a time per server process. Once in a full E2E run a PDF came out with one
// wrong glyph mapping ("." extracted as "*"). It couldn't be reproduced (24 concurrent renders,
// 39 repeated E2E runs), but shared font subsetting is the likely suspect and serialising is cheap.
let queue: Promise<unknown> = Promise.resolve();

export function renderBriefingPdf(snapshot: Snapshot): Promise<Buffer> {
  const job = queue.then(() => renderToBuffer(<BriefingPdf snapshot={snapshot} />));
  queue = job.catch(() => undefined);
  return job;
}

/** e.g. touchline-sunday-rovers-vs-riverside-dynamos-2026-10-24.pdf */
export function pdfFilename(snapshot: Snapshot): string {
  const slug = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // drop accents split off by NFKD: "Ü" → "U"
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  return `touchline-${slug(snapshot.team.name)}-vs-${slug(snapshot.match.opponent)}-${snapshot.match.kickoffAt.slice(0, 10)}.pdf`;
}
