import { readFile, writeFile } from "node:fs/promises";

const PROJECT_ID = process.env.SANITY_PROJECT_ID ?? "24o55ynn";
const DATASET = process.env.SANITY_DATASET ?? "production";
const OUT = new URL("../src/pages/projects.generated.json", import.meta.url);

const query = `*[_type == "project" && defined(slug.current) && defined(name)] | order(coalesce(order, 9999) asc) {
  "id": slug.current, name, blurb, description,
  "video": video.asset->url,
  "detailMedia": detailMedia[defined(asset)]{ "type": _type, "url": asset->url, "w": asset->metadata.dimensions.width, "h": asset->metadata.dimensions.height },
  "thumbnail": thumbnail.asset->url,
  deliverables, industry, year, client, role, link, collaborators
}`;

const strip = (o) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

const WATCH = process.argv.includes("--watch");

const run = async () => {
  try {
    const host = WATCH ? "api" : "apicdn"; // the CDN can serve a stale copy for a few seconds
    const url = `https://${PROJECT_ID}.${host}.sanity.io/v2025-01-01/data/query/${DATASET}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sanity responded ${res.status}`);
    const { result } = await res.json();
    const projects = result.map((p) =>
      strip({
        ...p,
        blurb: p.blurb ?? "",
        description: p.description ?? "",
        images: (p.detailMedia ?? []).filter((m) => m.type === "image").map((m) => m.url),
        deliverables: p.deliverables ?? "",
        industry: p.industry ?? "",
        year: p.year ?? "",
        collaborators: p.collaborators ?? [],
      })
    );
    const next = JSON.stringify(projects, null, 2);
    const prev = await readFile(OUT, "utf8").catch(() => "");
    if (next !== prev) {
      await writeFile(OUT, next); // only when something changed, so Vite doesn't reload for nothing
      console.log(`Updated ${projects.length} projects from Sanity`);
    }
  } catch (e) {
    console.warn("Sanity fetch skipped, keeping the existing file:", e.message); // build never breaks because of the CMS
  }
};

await run();
if (WATCH) setInterval(run, 10000);