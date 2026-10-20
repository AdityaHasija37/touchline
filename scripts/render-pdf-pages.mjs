// Renders every page of a PDF to PNG via pdfjs-dist in headless Chromium (visual PDF checks).
// Usage: node scripts/render-pdf-pages.mjs <file.pdf> <outDir>
import http from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const [pdfPath, outDir] = process.argv.slice(2);
const root = process.cwd();
const files = { "/pdf.mjs": `${root}/node_modules/pdfjs-dist/build/pdf.mjs`, "/pdf.worker.mjs": `${root}/node_modules/pdfjs-dist/build/pdf.worker.mjs`, "/doc.pdf": pdfPath };
const srv = http.createServer((req, res) => {
  if (req.url === "/") { res.setHeader("Content-Type", "text/html"); return res.end("<body style='margin:0'></body>"); }
  const f = files[req.url]; if (!f) { res.statusCode = 404; return res.end(); }
  res.setHeader("Content-Type", req.url.endsWith(".pdf") ? "application/pdf" : "text/javascript"); res.end(readFileSync(f));
}).listen(4789);
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1200, height: 860 } });
await page.goto("http://localhost:4789/");
const n = await page.evaluate(async () => {
  const pdfjs = await import("/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  const doc = await pdfjs.getDocument({ url: "/doc.pdf" }).promise; window.__doc = doc; return doc.numPages;
});
for (let i = 1; i <= n; i++) {
  const text = await page.evaluate(async (i) => {
    const pg = await window.__doc.getPage(i); const vp = pg.getViewport({ scale: 1.4 });
    document.body.innerHTML = ""; const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; document.body.append(c);
    await pg.render({ canvas: c, viewport: vp }).promise;
    return (await pg.getTextContent()).items.map((x) => x.str).join(" ").slice(0, 120);
  }, i);
  await page.locator("canvas").screenshot({ path: `${outDir}/page-${i}.png` });
  console.log(`page ${i}: ${text}`);
}
await b.close(); srv.close();
