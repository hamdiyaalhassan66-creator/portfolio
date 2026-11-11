import { TRACKS } from "./tracks";

export type LoreCategory = "music" | "films" | "books" | "photos";

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
    { id: "indigo", title: "Indigo", creator: "RM", kind: "Album", genre: "Hip-hop", year: 2022, songs: 10, image: "/lore/music/indigo.png" },
    { id: "invincible", title: "Invincible", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 2001, songs: 16, image: "/lore/music/invincible.png" },
    { id: "arirang", title: "Arirang", creator: "BTS", kind: "Album", genre: "Pop", year: 2026, songs: 14, image: "/lore/music/arirang.png"},
    { id: "the-romantic", title: "The Romantic", creator: "Bruno Mars", kind: "Album", genre: "R&B", year: 2026, songs: 9, image: "/lore/music/the-romantic.png" },
    { id: "silk-sonic", title: "An Evening with Silk Sonic", creator: "Silk Sonic", kind: "Album", genre: "R&B", year: 2021, songs: 9, image: "/lore/music/silk-sonic.png" },
    { id: "best-of-sade", title: "The Best of Sade", creator: "Sade", kind: "Compilation", genre: "Soul", year: 1994, songs: 16, image: "/lore/music/best-of-sade.png" },
    { id: "dangerous", title: "Dangerous", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1991, songs: 14, image: "/lore/music/dangerous.png" },
    { id: "thriller", title: "Thriller", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1982, songs: 9, image: "/lore/music/thriller.png" },
    { id: "bad", title: "Bad", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1987, songs: 10, image: "/lore/music/bad.png" },
    { id: "off-the-wall", title: "Off the Wall", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1979, songs: 10, image: "/lore/music/off-the-wall.png" },
    { id: "history", title: "HIStory", creator: "Michael Jackson", kind: "Album", genre: "Pop", year: 1995, songs: 30, image: "/lore/music/history.png" },
    { id: "layover", title: "Layover", creator: "V", kind: "Album", genre: "R&B", year: 2023, songs: 6, image: "/lore/music/layover.png" },
    { id: "hit-me-hard-and-soft", title: "Hit Me Hard and Soft", creator: "Billie Eilish", kind: "Album", genre: "Pop", year: 2024, songs: 10, image: "/lore/music/hit-me-hard-and-soft.png" },
    { id: "anti", title: "ANTI", creator: "Rihanna", kind: "Album", genre: "R&B", year: 2016, songs: 13, image: "/lore/music/anti.png" },
    { id: "24k-magic", title: "24K Magic", creator: "Bruno Mars", kind: "Album", genre: "Funk", year: 2016, songs: 9, image: "/lore/music/24k-magic.png" },
    { id: "not-cute-anymore", title: "Not Cute Anymore", creator: "ILLIT", kind: "Single", genre: "K-pop", year: 2025, songs: 2, image: "/lore/music/not-cute-anymore.png" },

    // singles
    { id: "woke-up", title: "Woke Up", creator: "XG", kind: "Single", genre: "Hip-hop", year: 2024, songs: 2, image: "/lore/music/woke-up.png" },
    { id: "hypnotize", title: "Hypnotize", creator: "XG", kind: "Single", genre: "Pop", year: 2025, songs: 2, image: "/lore/music/hypnotize.png" },
    { id: "shooting-star", title: "Shooting Star", creator: "XG", kind: "Single", genre: "Hip-hop", year: 2022, songs: 2, image: "/lore/music/shooting-star.png" },
    { id: "almost-tomorrow", title: "Almost Tomorrow", creator: "Etoile & Veloux", kind: "Single", songs: 2, image: "/lore/music/almost-tomorrow.png" },
    { id: "over-the-moon", title: "Over The Moon", creator: "Khaotung Thanawat", kind: "Single", songs: 2, image: "/lore/music/over-the-moon.png" },
    { id: "killin-it-girl", title: "Killin' It Girl", creator: "j-hope", kind: "Single", genre: "Hip-hop", year: 2025, songs: 2, image: "/lore/music/killin-it-girl.png" },
    { id: "sweet-dreams", title: "Sweet Dreams", creator: "j-hope", kind: "Single", genre: "R&B", year: 2025, songs: 2, image: "/lore/music/sweet-dreams.png" },
    { id: "mona-lisa", title: "Mona Lisa", creator: "j-hope", kind: "Single", genre: "Hip-hop", year: 2025, songs: 2, image: "/lore/music/mona-lisa.png" },
    { id: "good-goodbye", title: "Good Goodbye", creator: "Hwasa", kind: "Single", genre: "K-pop", songs: 2, image: "/lore/music/good-goodbye.png" },
    { id: "fly-me-to-the-moon", title: "Fly Me to the Moon (In Other Words)", creator: "Frank Sinatra & Count Basie", kind: "Single", genre: "Jazz", year: 1964, songs: 1, image: "/lore/music/fly-me-to-the-moon.png" },
    { id: "my-way", title: "My Way", creator: "Frank Sinatra", kind: "Single", genre: "Pop", year: 1969, songs: 1, image: "/lore/music/my-way.png" },
    { id: "easy", title: "Easy", creator: "Anna Wise & Xavier Omar", kind: "Single", genre: "R&B", songs: 1, image: "/lore/music/easy.png" },
    { id: "nothing-without-you", title: "Nothing Without You", creator: "Tanerélle", kind: "Single", genre: "R&B", songs: 1, image: "/lore/music/nothing-without-you.png" },

    // albums
    { id: "right-place-wrong-person", title: "Right Place, Wrong Person", creator: "RM", kind: "Album", genre: "Hip-hop", year: 2024, songs: 11, image: "/lore/music/right-place-wrong-person.png" },
    { id: "over-it", title: "Over It", creator: "Summer Walker", kind: "Album", genre: "R&B", year: 2019, songs: 17, image: "/lore/music/over-it.png" },
    { id: "the-greatest-showman", title: "The Greatest Showman", creator: "Various Artists", kind: "Soundtrack", genre: "Soundtrack", year: 2017, songs: 11, image: "/lore/music/the-greatest-showman.png" },
    { id: "golden", title: "Golden", creator: "Jungkook", kind: "Album", genre: "Pop", year: 2023, songs: 11, image: "/lore/music/golden.png" },
    { id: "plastic-hearts", title: "Plastic Hearts", creator: "Miley Cyrus", kind: "Album", genre: "Rock", year: 2020, songs: 15, image: "/lore/music/plastic-hearts.png" },
    { id: "jack-in-the-box", title: "Jack In The Box", creator: "j-hope", kind: "Album", genre: "Hip-hop", year: 2022, songs: 10, image: "/lore/music/jack-in-the-box.png" },
    { id: "lemonade", title: "Lemonade", creator: "Beyoncé", kind: "Album", genre: "R&B", year: 2016, songs: 12, image: "/lore/music/lemonade.png" },
    { id: "shot-callers", title: "Shot Callers", creator: "LNGSHOT", kind: "Album", genre: "Hip-hop", image: "/lore/music/shot-callers.png" },
  ],
  films: [],
  books: [],
  photos: [],
};

// attach tracklists once, so the item objects keep the same identity between renders
for (const list of Object.values(lore)) {
  for (const item of list) item.tracks ??= TRACKS[item.id];
}

// spreads the singles evenly between the other items instead of leaving them in one block
function mix(list: LoreItem[]): LoreItem[] {
  const singles = list.filter((i) => i.kind === "Single");
  const rest = list.filter((i) => i.kind !== "Single");
  if (!singles.length || !rest.length) return list;
  const gap = list.length / singles.length;
  const out: LoreItem[] = [];
  let s = 0;
  let r = 0;
  for (let i = 0; i < list.length; i++) {
    const due = s < singles.length && i >= Math.floor((s + 0.5) * gap);
    out.push(due || r >= rest.length ? singles[s++] : rest[r++]);
  }
  return out;
}
lore.music = mix(lore.music); // done once, so the array keeps the same identity between renders

export function getLoreItems(category: LoreCategory): LoreItem[] {
  return lore[category];
}