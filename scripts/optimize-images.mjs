import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DIR = "public/works";
const WIDTHS = [480, 864, 1296];

for (const file of await readdir(DIR)) {
  if (!/-\d+\.jpg$/.test(file)) continue; // only the gallery shots, not already-resized files
  const base = join(DIR, file.replace(/\.jpg$/, ""));
  for (const w of WIDTHS) {
    const img = sharp(join(DIR, file)).resize({ width: w, withoutEnlargement: true });
    await img.clone().avif({ quality: 55 }).toFile(`${base}-${w}.avif`);
    await img.clone().webp({ quality: 78 }).toFile(`${base}-${w}.webp`);
  }
}