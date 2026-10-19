/**
 * Deterministic word wrap for on-pitch notes, shared by the Konva editor and the SVG renderer
 * so text breaks identically in the editor, presenter and PDF (TECH-003 §7).
 */
export const TEXT_LINE_CHARS = 22;

export function wrapText(text: string, max = TEXT_LINE_CHARS): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    // Hard-break words longer than a line.
    for (let w = word; w.length; ) {
      const room = line ? max - line.length - 1 : max;
      if (w.length <= room) {
        line = line ? `${line} ${w}` : w;
        w = "";
      } else if (!line && w.length > max) {
        lines.push(w.slice(0, max));
        w = w.slice(max);
      } else {
        lines.push(line);
        line = "";
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}
