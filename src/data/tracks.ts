import type { Track } from "./lore";

const t = (...titles: string[]): Track[] => titles.map((title) => ({ title }));

export const TRACKS: Record<string, Track[]> = {
  indigo: t(
    "Yun (with Erykah Badu)", "Still Life (with Anderson .Paak)", "All Day (with Tablo)",
    "Forg_tful (with Kim Sawol)", "Closer (with Paul Blanco, Mahalia)", "Change pt.2",
    "Lonely", "Hectic (with Colde)", "Wild Flower (with youjeen)", "No.2 (with Park Jiyoon)"
  ),
  invincible: t(
    "Unbreakable", "Heartbreaker", "Invincible", "Break of Dawn", "Heaven Can Wait",
    "You Rock My World", "Butterflies", "Speechless", "2000 Watts", "You Are My Life",
    "Privacy", "Don't Walk Away", "Cry", "The Lost Children", "Whatever Happens", "Threatened"
  ),
  arirang: t(
    "Body to Body", "Hooligan", "Aliens", "FYA", "2.0", "No. 29", "SWIM", "Merry Go Round",
    "NORMAL", "Like Animals", "they don't know 'bout us", "One More Night", "Please", "Into the Sun"
  ),
  "the-romantic": t(
    "Risk It All", "Cha Cha Cha", "I Just Might", "God Was Showing Off", "Why You Wanna Fight?",
    "On My Soul", "Something Serious", "Nothing Left", "Dance With Me"
  ),
  "silk-sonic": t(
    "Silk Sonic Intro", "Leave the Door Open", "Fly as Me", "After Last Night", "Smokin Out the Window",
    "Put On a Smile", "777", "Skate", "Blast Off"
  ),
  "best-of-sade": t(
    "Your Love Is King", "Hang On to Your Love", "Smooth Operator", "Jezebel", "The Sweetest Taboo",
    "Is It a Crime", "Never as Good as the First Time", "Love Is Stronger Than Pride", "Paradise",
    "Nothing Can Come Between Us", "No Ordinary Love", "Like a Tattoo", "Kiss of Life",
    "Please Send Me Someone to Love", "Cherish the Day", "Pearls"
  ),
  dangerous: t(
    "Jam", "Why You Wanna Trip on Me", "In the Closet", "She Drives Me Wild", "Remember the Time",
    "Can't Let Her Get Away", "Heal the World", "Black or White", "Who Is It", "Give In to Me",
    "Will You Be There", "Keep the Faith", "Gone Too Soon", "Dangerous"
  ),
  thriller: t(
    "Wanna Be Startin' Somethin'", "Baby Be Mine", "The Girl Is Mine", "Thriller", "Beat It",
    "Billie Jean", "Human Nature", "P.Y.T. (Pretty Young Thing)", "The Lady in My Life"
  ),
  bad: t(
    "Bad", "The Way You Make Me Feel", "Speed Demon", "Liberian Girl", "Just Good Friends",
    "Another Part of Me", "Man in the Mirror", "I Just Can't Stop Loving You", "Dirty Diana", "Smooth Criminal"
  ),
  "off-the-wall": t(
    "Don't Stop 'Til You Get Enough", "Rock with You", "Working Day and Night", "Get on the Floor",
    "Off the Wall", "Girlfriend", "She's Out of My Life", "I Can't Help It",
    "It's the Falling in Love", "Burn This Disco Out"
  ),
  history: t(
    "Billie Jean", "The Way You Make Me Feel", "Black or White", "Rock with You", "She's Out of My Life",
    "Bad", "I Just Can't Stop Loving You", "Man in the Mirror", "Thriller", "Beat It", "The Girl Is Mine",
    "Remember the Time", "Don't Stop 'Til You Get Enough", "Wanna Be Startin' Somethin'", "Heal the World",
    "Scream", "They Don't Care Information Us", "Stranger in Moscow", "This Time Around", "Earth Song", "D.S.",
    "Money", "Come Together", "You Are Not Alone", "Childhood (Theme from Free Willy 2)", "Tabloid Junkie",
    "2 Bad", "HIStory", "Little Susie", "Smile"
  ),
  layover: [
    { title: "Rainy Days", duration: "2:59" },
    { title: "Blue", duration: "2:29" },
    { title: "Love Me Again", duration: "3:02" },
    { title: "Slow Dancing", duration: "3:07" },
    { title: "For Us", duration: "2:51" },
    { title: "Slow Dancing (Piano Ver.)", duration: "3:08" },
  ],
  "hit-me-hard-and-soft": t(
    "Skinny", "Lunch", "Chihiro", "Birds of a Feather", "Wildflower", "The Greatest",
    "L'Amour de Ma Vie", "The Diner", "Bittersuite", "Blue"
  ),
  anti: t(
    "Consideration", "James Joint", "Kiss It Better", "Work", "Desperado", "Woo", "Needed Me",
    "Yeah, I Said It", "Same Ol' Mistakes", "Never Ending", "Love on the Brain", "Higher", "Close to You"
  ),
  "24k-magic": t(
    "24K Magic", "Chunky", "Perm", "That's What I Like", "Versace on the Floor",
    "Straight Up & Down", "Calling All My Lovelies", "Finesse", "Too Good to Say Goodbye"
  ),
  "not-cute-anymore": t("NOT CUTE ANYMORE", "NOT ME"),
};

// durations in track order, space separated
const DURATIONS: Record<string, string> = {
  "indigo": "3:54 2:55 3:06 2:42 3:17 1:54 2:46 3:46 4:33 3:14",
  "invincible": "6:26 5:10 4:45 5:32 4:49 5:38 4:40 3:18 4:24 4:33 5:04 4:25 5:00 4:00 4:56 4:20",
  "arirang": "3:09 3:02 2:47 3:00 2:49 1:38 2:39 3:49 3:01 3:09 2:44 2:47 2:52 3:47",
  "the-romantic": "3:24 3:56 3:32 3:31 4:14 2:54 2:46 3:34 3:39",
  "silk-sonic": "1:03 4:02 3:39 4:09 3:17 4:15 2:45 3:23 4:44",
  "best-of-sade": "3:43 4:31 4:18 5:25 4:25 6:17 3:59 4:18 3:37 3:53 7:20 3:37 4:11 3:42 6:19 4:37",
  "dangerous": "5:39 5:24 6:32 3:42 4:01 4:59 6:25 4:16 6:35 5:30 7:40 5:57 3:22 7:00",
  "thriller": "6:03 4:20 3:42 5:58 4:17 4:57 4:06 3:58 5:00",
  "bad": "4:08 4:59 4:03 3:55 4:09 3:55 5:21 4:27 4:42 4:20",
  "off-the-wall": "6:05 3:40 5:14 4:50 4:06 3:04 3:38 4:30 3:48 3:42",
  "history":
    "4:54 4:57 4:15 3:40 3:37 4:07 4:11 5:19 5:57 4:18 3:41 3:59 6:04 6:02 6:25 " +
    "4:38 4:44 5:44 4:21 6:46 4:49 4:41 4:02 5:45 4:27 4:32 4:49 6:37 6:13 4:55",
  "hit-me-hard-and-soft": "3:39 2:59 5:03 3:30 4:21 4:53 5:33 3:06 4:58 5:43",
  "anti": "2:41 1:12 4:13 3:39 3:06 3:55 3:11 2:13 6:37 3:22 3:44 2:00 3:43",
  "24k-magic": "3:46 3:06 3:30 3:26 4:21 3:18 4:10 3:10 4:41",
  "not-cute-anymore": "2:11 2:34",
};

for (const [id, times] of Object.entries(DURATIONS)) {
  times.split(" ").forEach((duration, i) => {
    const track = TRACKS[id]?.[i];
    if (track) track.duration ??= duration;
  });
}