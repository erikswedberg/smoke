// Tiny image inspector: prints format + dimensions for downloaded logo files.
// Supports PNG, JPEG, GIF, WEBP, SVG. No deps.
import { readFileSync, statSync } from "node:fs";

function info(path) {
  const b = readFileSync(path);
  const size = statSync(path).size;
  let fmt = "unknown", w = 0, h = 0;
  if (b[0] === 0x89 && b[1] === 0x50) { // PNG
    fmt = "png"; w = b.readUInt32BE(16); h = b.readUInt32BE(20);
  } else if (b[0] === 0xff && b[1] === 0xd8) { // JPEG
    fmt = "jpeg";
    let o = 2;
    while (o < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        h = b.readUInt16BE(o + 5); w = b.readUInt16BE(o + 7); break;
      }
      o += 2 + b.readUInt16BE(o + 2);
    }
  } else if (b[0] === 0x47 && b[1] === 0x49) { // GIF
    fmt = "gif"; w = b.readUInt16LE(6); h = b.readUInt16LE(8);
  } else if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") {
    fmt = "webp";
    const c = b.slice(12, 16).toString();
    if (c === "VP8 ") { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
    else if (c === "VP8L") { const n = b.readUInt32LE(21); w = (n & 0x3fff) + 1; h = ((n >> 14) & 0x3fff) + 1; }
    else if (c === "VP8X") { w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1; h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1; }
  } else {
    const head = b.slice(0, 400).toString("utf8").toLowerCase();
    if (head.includes("<svg")) {
      fmt = "svg";
      const vb = head.match(/viewbox=["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
      const ww = head.match(/width=["']([\d.]+)/), hh = head.match(/height=["']([\d.]+)/);
      if (ww) w = Math.round(+ww[1]); if (hh) h = Math.round(+hh[1]);
      if (!w && vb) { w = Math.round(+vb[1]); h = Math.round(+vb[2]); }
    } else if (head.includes("<!doctype html") || head.includes("<html")) {
      fmt = "HTML(not-image!)";
    }
  }
  const sq = w && h ? (Math.max(w, h) / Math.min(w, h)).toFixed(2) : "?";
  console.log(`${path.split("/").pop().padEnd(28)} ${fmt.padEnd(16)} ${w}x${h}  ar=${sq}  ${(size/1024).toFixed(1)}KB`);
}
for (const p of process.argv.slice(2)) { try { info(p); } catch (e) { console.log(p, "ERR", e.message); } }
