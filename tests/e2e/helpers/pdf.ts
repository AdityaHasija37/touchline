import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Text of each page of a PDF, whitespace-collapsed. */
export async function pdfPages(data: Buffer | Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(data), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return pages;
}
