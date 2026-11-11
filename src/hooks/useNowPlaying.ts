import { useEffect, useState } from "react";

export type NowPlaying = {
  playing: boolean;
  title?: string;
  artist?: string;
  album?: string;
  cover?: string;
  progress?: number;
  duration?: number;
  url?: string;
  at: number; // when this was fetched, so progress can keep counting between polls
};

const IDLE: NowPlaying = { playing: false, at: 0 };

export function useNowPlaying(everyMs = 8000) {
  const [np, setNp] = useState<NowPlaying>(IDLE);
  useEffect(() => {
    let dead = false;
    const pull = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/spotify");
        const d = await r.json();
        if (!dead) setNp({ ...d, at: Date.now() });
      } catch {
        if (!dead) setNp(IDLE);
      }
    };
    pull();
    const id = setInterval(pull, everyMs);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [everyMs]);
  return np;
}