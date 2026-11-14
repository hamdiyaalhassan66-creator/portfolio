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
    "Scream", "They Don't Care About Us", "Stranger in Moscow", "This Time Around", "Earth Song", "D.S.",
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
  "right-place-wrong-person": t(
    "Right People, Wrong Place", "Nuts", "out of love", "Domodachi (feat. Little Simz)",
    "? (Interlude)", "Groin", "Heaven", "LOST!",
    "Around the world in a day (feat. Moses Sumney)", "ㅠㅠ (Credit Roll)", "Come back to me"
  ),
  "over-it": t(
    "Over It", "Body", "Playing Games (Extended Version) (with Bryson Tiller)", "Drunk Dialing...LODT",
    "Come Thru (with Usher)", "Potential", "Fun Girl", "Tonight", "Me", "Like It (with 6LACK)",
    "Just Might (with PARTYNEXTDOOR)", "Stretch You Out (feat. A Boogie wit da Hoodie)", "Off of You",
    "Anna Mae", "I'll Kill You (feat. Jhené Aiko)", "Nobody Else", "Playing Games",
    "Girls Need Love (Remix) (with Drake)"
  ),
  "jack-in-the-box": t(
    "Intro", "Pandora's Box", "MORE", "STOP", "= (Equal Sign)", "Music Box : Reflection",
    "What if...", "Safety Zone", "Future", "Arson"
  ),
  "shot-callers": t("Backseat", "Saucin'", "Moonwalkin'", "FaceTime", "Never Let Go"),
  "killin-it-girl": t("Killin' It Girl (feat. GloRilla)", "Killin' It Girl (solo version)"),
  "woke-up": t("WOKE UP", "WOKE UP (INSTRUMENTAL)"),
  "almost-tomorrow": t("Almost Tomorrow"),
  "over-the-moon": t('คลาด (OVER THE MOON) - เพลงประกอบซีรีส์ "คาธ The ECLIPSE"'),
  "shooting-star": t("SHOOTING STAR", "LEFT RIGHT"),
  hypnotize: t("HYPNOTIZE"),
  "sweet-dreams": t("Sweet Dreams (feat. Miguel)"),
  "mona-lisa": t("MONA LISA"),
  "good-goodbye": t("Good Goodbye", "Good Goodbye (with. Duomo)"),
  "fly-me-to-the-moon": t("Fly Me to the Moon (In Other Words)"),
  "my-way": t("My Way"),
  easy: t("Easy"),
  "nothing-without-you": t("Nothing Without You"),
  lemonade: t(
    "Pray You Catch Me", "Hold Up", "Don't Hurt Yourself (feat. Jack White)", "Sorry",
    "6 Inch (feat. The Weeknd)", "Daddy Lessons", "Love Drought", "Sandcastles",
    "Forward (feat. James Blake)", "Freedom (feat. Kendrick Lamar)", "All Night", "Formation"
  ),
  "the-greatest-showman": t(
    "The Greatest Show", "A Million Dreams", "A Million Dreams (Reprise)", "Come Alive",
    "The Other Side", "Never Enough", "This Is Me", "Rewrite the Stars", "Tightrope",
    "Never Enough (Reprise)", "From Now On"
  ),
  golden: t(
    "3D (feat. Jack Harlow)", "Closer to You (feat. Major Lazer)", "Seven (feat. Latto) - Explicit Ver.",
    "Standing Next to You", "Yes or No", "Please Don't Change (feat. DJ Snake)", "Hate You", "Somebody",
    "Too Sad to Dance", "Shot Glass of Tears", "Seven (feat. Latto) - Clean Ver."
  ),
  "plastic-hearts": t(
    "WTF Do I Know", "Plastic Hearts", "Angels Like You", "Prisoner (feat. Dua Lipa)",
    "Gimme What I Want", "Night Crawling (feat. Billy Idol)", "Midnight Sky", "High", "Hate Me",
    "Bad Karma (feat. Joan Jett)", "Never Be Me", "Golden G String",
    "Edge of Midnight (Midnight Sky Remix) (feat. Stevie Nicks)",
    "Heart of Glass (Live from the iHeart Music Festival)",
    "Zombie (Live from the NIVA Save Our Stages Festival)"
  ),
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
  "right-place-wrong-person": "1:57 3:14 2:07 3:04 1:53 3:10 3:14 3:53 4:17 1:14 6:28",
  "over-it": "2:11 3:13 2:23 2:14 3:01 2:53 1:49 2:56 2:08 2:51 3:25 2:23 2:05 2:17 2:59 3:53 2:23 3:42",
  "shot-callers": "3:02 2:53 3:28 2:47 3:13",
  "killin-it-girl": "2:28 2:18",
  hypnotize: "2:51",
  "sweet-dreams": "2:52",
  lemonade: "3:16 3:41 3:54 3:53 4:20 4:47 3:57 3:02 1:19 4:49 5:22 3:26",
  "the-greatest-showman": "5:02 4:29 1:00 3:45 3:34 3:27 3:54 3:37 3:54 1:20 5:49",
  golden: "3:21 2:51 3:04 3:26 2:28 2:27 2:34 2:50 2:56 2:47 3:04",
  "plastic-hearts": "2:51 3:25 3:16 2:49 2:31 3:09 3:43 3:16 2:37 3:08 3:35 3:49 3:40 3:33 4:50",
  "almost-tomorrow": "5:18",
  "mona-lisa": "2:17",
  "good-goodbye": "3:43",
  "fly-me-to-the-moon": "2:27",
  "my-way": "4:35",
  easy: "2:16",
  "nothing-without-you": "5:19",
};

for (const [id, times] of Object.entries(DURATIONS)) {
  times.split(" ").forEach((duration, i) => {
    const track = TRACKS[id]?.[i];
    if (track) track.duration ??= duration;
  });
}