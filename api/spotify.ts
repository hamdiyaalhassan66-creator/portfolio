/// <reference types="node" />
const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;

let cached: { token: string; exp: number } | null = null;

async function getToken() {
  if (cached && Date.now() < cached.exp) return cached.token;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: SPOTIFY_REFRESH_TOKEN! }),
  });
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

export default async function handler(_req: any, res: any) {
  // one Spotify call per few seconds no matter how many visitors there are
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
  try {
    const token = await getToken();
    const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status !== 200) return res.status(200).json({ playing: false });
    const d = await r.json();
    if (d.currently_playing_type !== "track" || !d.item) return res.status(200).json({ playing: false });
    return res.status(200).json({
      playing: d.is_playing,
      title: d.item.name,
      artist: d.item.artists.map((a: { name: string }) => a.name).join(", "),
      album: d.item.album.name,
      cover: d.item.album.images[0]?.url,
      progress: d.progress_ms,
      duration: d.item.duration_ms,
      url: d.item.external_urls?.spotify,
    });
  } catch {
    return res.status(200).json({ playing: false });
  }
}