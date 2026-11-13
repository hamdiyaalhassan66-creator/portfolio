export type Collaborator = { role: string; name: string };

export type Project = {
  id: string;
  name: string;
  blurb: string; // short line in the works list
  description: string; // longer text in the detail page's Project Brief
  color: string; // square behind the logo
  mark?: string; // fallback text if there is no logo
  logo?: string;
  logoSize?: number; // logo width as a % of the 100px square
  images: string[]; // 5 slideshow images
  tags: string[];
  deliverables: string;
  industry: string;
  year: string;
  collaborators: Collaborator[];
  link?: string; // live site; the "Project link" row is hidden when this is empty
};

const BLURB = "A platform for building Africa's design community."; // placeholder, replace per project
const brief = (name: string) => `A website design done for ${name}. Replace this with the project brief.`;
const TEAM: Collaborator[] = [
  { role: "Agency", name: "Oxegene" },
  { role: "Developer", name: "Stephen" },
]; // placeholder, replace per project

const shots = (id: string) => [1, 2, 3, 4, 5].map((n) => `/works/${id}-${n}.jpg`);

export const PROJECTS: Project[] = [
  { id: "dex", name: "dEX Ghana", blurb: "A platform for building, connecting, and championing Africa's design community.", description: "A website design done for dEX Ghana. It is essentially a platform for building, connecting, educating, and championing Africa's design community.", color: "#FFC200", logo: "/works/dex-logo.svg", logoSize: 45, images: shots("dex"), tags: ["Website design", "Community", "2026"], deliverables: "Website Design", industry: "Community", year: "2026", collaborators: TEAM, link: "https://dexghana.com" },
  { id: "manntion", name: "MANNTION", blurb: BLURB, description: brief("MANNTION"), color: "#FFFFFF", logo: "/works/manntion-logo.svg", logoSize: 78, images: shots("manntion"), tags: ["Website design", "Portfolio", "Framer", "2025"], deliverables: "Website Design", industry: "Portfolio", year: "2025", collaborators: TEAM, link: "https://manntion.com" },
  { id: "khaya", name: "Khaya AI", blurb: BLURB, description: brief("Khaya AI"), color: "#1FB574", logo: "/works/khaya-ai-logo.svg", logoSize: 45, images: shots("khaya"), tags: ["Website design", "AI", "Framer", "2025"], deliverables: "Website Design", industry: "AI", year: "2025", collaborators: TEAM, link: "https://khaya.ai" },
  { id: "gecric", name: "Gecric Integrity", blurb: BLURB, description: brief("Gecric Integrity"), color: "#F4F4F0", logo: "/works/gecric-logo.svg", logoSize: 78, images: shots("gecric"), tags: ["Website design", "Energy/Industrial", "2025"], deliverables: "Website Design", industry: "Energy/Industrial", year: "2025", collaborators: TEAM, link: "https://gecric.com" },
  { id: "his-son-jesus", name: "HIS SON JESUS", blurb: BLURB, description: brief("HIS SON JESUS"), color: "#A58C6D", logo: "/works/his-son-jesus-logo.svg", logoSize: 78, images: shots("his-son-jesus"), tags: ["Website design", "E-commerce", "2025"], deliverables: "Website Design", industry: "E-commerce", year: "2025", collaborators: TEAM, link: "https://hissonjesus.com" },
  { id: "digiits", name: "Digiits Agency", blurb: BLURB, description: brief("Digiits Agency"), color: "#057CDD", logo: "/works/digiits-logo.svg", logoSize: 78, images: shots("digiits"), tags: ["Website design", "Consulting", "Framer", "2025"], deliverables: "Website Design", industry: "Consulting", year: "2025", collaborators: TEAM, link: "https://digiits.com" },
  { id: "bittern", name: "Bittern Consulting", blurb: BLURB, description: brief("Bittern Consulting"), color: "#FAFF9F", logo: "/works/bittern-logo.svg", logoSize: 45, images: shots("bittern"), tags: ["Website design", "Consulting", "Framer", "2024"], deliverables: "Website Design", industry: "Consulting", year: "2024", collaborators: TEAM, link: "https://bitternconsulting.com" },
];

// default slideshow (nothing hovered): the first 3 images of each project, alternating between projects
export const DEFAULT_SHOTS = [0, 1, 2].flatMap((i) => PROJECTS.map((p) => p.images[i]));
export const ALL_SHOTS = PROJECTS.flatMap((p) => p.images);
export const SLIDE_MS = 1200; // time each image stays on screen (lower = faster)