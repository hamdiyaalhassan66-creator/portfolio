import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const DIR = "public/works";
const WIDTHS = [480, 864, 1296];

const exists = (p) => stat(p).then(() => true, () => false);
const force = process.argv.includes("--force"); // node scripts/optimize-images.mjs --force rebuilds everything

const make = async (src, out, w, ext) => {
  if (!force && (await exists(out))) return;
  const img = sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
  await (ext === "avif" ? img.avif({ quality: 55 }) : img.webp({ quality: 78 })).toFile(out);
};

for (const file of await readdir(DIR)) {
  if (!/-\d+\.jpg$/.test(file)) continue; // only the gallery shots, not already-resized files
  const src = join(DIR, file);
  const base = join(DIR, file.replace(/\.jpg$/, ""));
  await Promise.all(
    WIDTHS.flatMap((w) => ["avif", "webp"].map((ext) => make(src, `${base}-${w}.${ext}`, w, ext))),
  );
}