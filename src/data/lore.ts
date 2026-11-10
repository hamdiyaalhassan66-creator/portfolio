import { TRACKS } from "./tracks";

export type LoreCategory = "music" | "films" | "books";

export type Track = {
  title: string;
  side?: string; // "A", "B"... or "1", "2" for multi-disc releases
  duration?: string; // "3:09"
};

export type LoreItem = {
  id: string;
  title: string;
  creator: string; // artist / director / author
  kind?: string; // "Album", "Film", "Book"
  genre?: string;
  year?: number;
  songs?: number;
  creatorUrl?: string; // makes the artist name a link
  image: string;
  tracks?: Track[];
};

const lore: Record<LoreCategory, LoreItem[]> = {
  music: [
    { id: "indigo", title: "Indigo", creator: "RM", kind: "Album", genre: "Hip-hop", year: 2022, songs: 10, image: "/lore/music/indigo.jpg" },
    { id: "invincible", title: "Invincible", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 2001, songs: 16, image: "/lore/music/invincible.jpg" },
    { id: "arirang", title: "Arirang", creator: "BTS", kind: "Album", genre: "Pop", year: 2026, songs: 14, image: "/lore/music/arirang.png"},
    { id: "the-romantic", title: "The Romantic", creator: "Bruno Mars", kind: "Album", genre: "R&B", year: 2026, songs: 9, image: "/lore/music/the-romantic.png" },
    { id: "silk-sonic", title: "An Evening with Silk Sonic", creator: "Silk Sonic", kind: "Album", genre: "R&B", year: 2021, songs: 9, image: "/lore/music/silk-sonic.png" },
    { id: "best-of-sade", title: "The Best of Sade", creator: "Sade", kind: "Compilation", genre: "Soul", year: 1994, songs: 16, image: "/lore/music/best-of-sade.png" },
    { id: "dangerous", title: "Dangerous", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1991, songs: 14, image: "/lore/music/dangerous.jpg" },
    { id: "thriller", title: "Thriller", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1982, songs: 9, image: "/lore/music/thriller.png" },
    { id: "bad", title: "Bad", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1987, songs: 10, image: "/lore/music/bad.png" },
    { id: "off-the-wall", title: "Off the Wall", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1979, songs: 10, image: "/lore/music/off-the-wall.jpg" },
    { id: "history", title: "HIStory", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1995, songs: 30, image: "/lore/music/history.jpg" },
    { id: "layover", title: "Layover", creator: "V", kind: "Album", genre: "R&B", year: 2023, songs: 6, image: "/lore/music/layover.png" },
    { id: "hit-me-hard-and-soft", title: "Hit Me Hard and Soft", creator: "Billie Eilish", kind: "Album", genre: "Pop", year: 2024, songs: 10, image: "/lore/music/hit-me-hard-and-soft.png" },
    { id: "anti", title: "ANTI", creator: "Rihanna", kind: "Album", genre: "R&B", year: 2016, songs: 13, image: "/lore/music/anti.png" },
    { id: "24k-magic", title: "24K Magic", creator: "Bruno Mars", kind: "Album", genre: "Funk", year: 2016, songs: 9, image: "/lore/music/24k-magic.jpg" },
    { id: "not-cute-anymore", title: "Not Cute Anymore", creator: "ILLIT", kind: "Single", genre: "K-pop", year: 2025, songs: 2, image: "/lore/music/not-cute-anymore.png" },
  ],
  films: [],
  books: [],
};

// attach tracklists once, so the item objects keep the same identity between renders
for (const list of Object.values(lore)) {
  for (const item of list) item.tracks ??= TRACKS[item.id];
}

export function getLoreItems(category: LoreCategory): LoreItem[] {
  return lore[category];
}