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
};