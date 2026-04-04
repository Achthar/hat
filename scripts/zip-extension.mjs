import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from "fs";
import { join, relative } from "path";
import { createDeflateRaw } from "zlib";

const SRC = "packages/extension/dist";
const OUT = "packages/web/public/hat-extension.zip";

function collectFiles(dir, base = dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push({ path: relative(base, full) + "/", data: null });
      files = files.concat(collectFiles(full, base));
    } else {
      files.push({ path: relative(base, full), data: readFileSync(full) });
    }
  }
  return files;
}

function deflate(buf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const d = createDeflateRaw();
    d.on("data", (c) => chunks.push(c));
    d.on("end", () => resolve(Buffer.concat(chunks)));
    d.on("error", reject);
    d.end(buf);
  });
}

function dosTime(date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) >>> 0;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) >>> 0;
  return { time, date: day };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function createZip() {
  const files = collectFiles(SRC);
  const now = new Date();
  const { time, date } = dosTime(now);
  const entries = [];
  const parts = [];
  let offset = 0;

  for (const f of files) {
    const isDir = f.data === null;
    const raw = isDir ? Buffer.alloc(0) : f.data;
    const compressed = isDir ? Buffer.alloc(0) : await deflate(raw);
    const method = isDir ? 0 : 8;
    const crc = isDir ? 0 : crc32(raw);
    const nameBytes = Buffer.from(f.path);

    // Local file header
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    entries.push({ nameBytes, crc, compressed, raw, method, offset, isDir, time, date });
    parts.push(local, compressed);
    offset += local.length + compressed.length;
  }

  // Central directory
  const centralParts = [];
  for (const e of entries) {
    const cd = Buffer.alloc(46 + e.nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(e.method, 10);
    cd.writeUInt16LE(e.time, 12);
    cd.writeUInt16LE(e.date, 14);
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.compressed.length, 20);
    cd.writeUInt32LE(e.raw.length, 24);
    cd.writeUInt16LE(e.nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(e.isDir ? 0x10 : 0, 38);
    cd.writeUInt32LE(e.offset, 42);
    e.nameBytes.copy(cd, 46);
    centralParts.push(cd);
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const zip = Buffer.concat([...parts, centralDir, eocd]);
  mkdirSync("packages/web/public", { recursive: true });
  writeFileSync(OUT, zip);
  console.log(`Created ${OUT} (${(zip.length / 1024).toFixed(1)} KB, ${entries.length} entries)`);
}

createZip();
