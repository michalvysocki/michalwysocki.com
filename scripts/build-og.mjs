// Generates assets/og.svg, public/og.png, public/favicon.svg, public/favicon.ico and
// public/apple-touch-icon.png. Text is converted to paths, so the output doesn't
// depend on fonts installed on the machine.
// Run with `npm run og` after changing the headline in src/components/Hero.astro.
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";
import { simulate } from "../src/lib/rollout.ts";

const root = path.join(import.meta.dirname, "..");
const load = (p) => opentype.loadSync(path.join(root, "node_modules/@fontsource", p));
const grotesk600 = [load("schibsted-grotesk/files/schibsted-grotesk-latin-600-normal.woff"), load("schibsted-grotesk/files/schibsted-grotesk-latin-ext-600-normal.woff")];
const grotesk400 = [load("schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff"), load("schibsted-grotesk/files/schibsted-grotesk-latin-ext-400-normal.woff")];

// Light theme tokens from src/styles/global.css.
const C = { bg: "#efefed", fg: "#1c1d20", muted: "#5f6267", accent: "#8f5d10", line: "#d8d8d4" };

// Text to path data, falling back to latin-ext for glyphs like "ł".
function text(fonts, str, x, y, size, tracking = 0) {
  let d = "";
  let cx = x;
  for (const ch of str) {
    const font = fonts.find((f) => f.charToGlyphIndex(ch) > 0) ?? fonts[0];
    const g = font.charToGlyph(ch);
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth / font.unitsPerEm) * size + tracking * size;
  }
  return d;
}

// --- Open Graph image ---------------------------------------------------------
const W = 1200, H = 630, P = 72;
// The headline from src/components/Hero.astro, broken into lines by hand.
const head = ["I build models that predict", "the physical world, and study", "where they stop being right."];
const steps = 44;
const { observed, rollout, drift } = simulate(steps);
const cx0 = P, cx1 = W - P, cy = 470, ch = 70;
const px = (i) => cx0 + (i / steps) * (cx1 - cx0);
const py = (v) => cy - (v / 1.4) * ch;
const line = (vs) => vs.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <path d="${text(grotesk600, "Michał Wysocki", P, 104, 30, -0.01)}" fill="${C.fg}"/>
  ${head.map((l, i) => `<path d="${text(grotesk600, l, P - 3, 200 + i * 70, 64, -0.025)}" fill="${C.fg}"/>`).join("\n  ")}
  <line x1="${px(drift)}" x2="${px(drift)}" y1="${cy - ch - 8}" y2="${cy + ch + 8}" stroke="${C.muted}" stroke-width="1.5" stroke-dasharray="4 5"/>
  <path d="${line(rollout)}" fill="none" stroke="${C.accent}" stroke-width="4" stroke-linejoin="round"/>
  <path d="${line(observed)}" fill="none" stroke="${C.fg}" stroke-width="2" stroke-linejoin="round"/>
  <path d="${text(grotesk400, "michalwysocki.com", P, 590, 24)}" fill="${C.muted}"/>
</svg>
`;
fs.writeFileSync(path.join(root, "assets/og.svg"), og);
await sharp(Buffer.from(og)).png({ compressionLevel: 9, palette: true }).toFile(path.join(root, "public/og.png"));

// --- Icons: two trajectories that agree, then split --------------------------
const glyph = (stroke) => `
  <path d="M30 32 L51 46" stroke="#d9a050" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M12 32 L30 32 L51 18" stroke="#efefed" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1c1d20"/>${glyph(6)}
</svg>
`;
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#1c1d20"/>
  <g transform="translate(6.4 6.4) scale(0.8)">${glyph(6)}</g>
</svg>
`;
fs.writeFileSync(path.join(root, "public/favicon.svg"), favicon);
await sharp(Buffer.from(touch), { density: 300 }).resize(180, 180).flatten({ background: "#1c1d20" }).png().toFile(path.join(root, "public/apple-touch-icon.png"));

// ICO with 16px and 32px PNG entries.
const pngs = await Promise.all([16, 32].map((s) => sharp(Buffer.from(favicon), { density: 300 }).resize(s, s).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((buf, i) => {
  const s = [16, 32][i], e = 6 + i * 16;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += buf.length;
});
fs.writeFileSync(path.join(root, "public/favicon.ico"), Buffer.concat([header, ...pngs]));

console.log("Wrote og.svg, og.png, favicon.svg, favicon.ico, apple-touch-icon.png");
