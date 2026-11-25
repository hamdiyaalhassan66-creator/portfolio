import generated from "./projects.generated.json";

export type Collaborator = { role: string; name: string };

export type Project = {
  id: string;
  name: string;
  blurb: string; // short line in the works list
  description: string; // longer text in the detail page's Project Brief
  images: string[]; // slideshow images
  video?: string; // hover preview, from Sanity
  detailMedia?: { type: "image" | "video"; url: string; w?: number | null; h?: number | null }[]; // detail page grid, in Sanity order
  thumbnail?: string; // main card image on the Work page, from Sanity
  deliverables: string;
  industry: string;
  year: string;
  collaborators: Collaborator[];
  link?: string; // live site; the "Project link" row is hidden when this is empty
  role?: string;
  client?: string;
};

// responsive variants for local images, made by scripts/optimize-images.mjs
const WIDTHS = [480, 864, 1296, 1728, 2400];
export const srcSet = (src: string, ext: "avif" | "webp") =>
  src.startsWith("http")
    ? WIDTHS.map((w) => `${src}?w=${w}&auto=format&q=85 ${w}w`).join(", ") // Sanity CDN resizes and picks the format
    : WIDTHS.map((w) => `${src.replace(/\.jpg$/, "")}-${w}.${ext} ${w}w`).join(", ");

export const PROJECTS: Project[] = generated as Project[]; // filled by scripts/fetch-projects.mjs from Sanity

// default slideshow (nothing hovered): the first 3 images of each project, alternating between projects
export const DEFAULT_SHOTS = [0, 1, 2].flatMap((i) => PROJECTS.map((p) => p.images[i])).filter((s): s is string => !!s);
export const ALL_SHOTS = PROJECTS.flatMap((p) => p.images);
export const SLIDE_MS = 1200; // time each image stays on screen (lower = faster)