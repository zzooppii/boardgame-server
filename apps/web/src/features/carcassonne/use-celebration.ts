import { useEffect, useRef, useState } from "react";
import type { CarcassonneProjection } from "@hangul-rummikub/shared";
import {
  carcassonneCelebration,
  type CarcassonneCelebration,
} from "./scoring.js";
export function useCarcassonneCelebration(
  game: CarcassonneProjection,
  connected: boolean,
) {
  const previous = useRef({ game, connected }),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [event, setEvent] = useState<CarcassonneCelebration | null>(null);
  useEffect(() => {
    const old = previous.current;
    previous.current = { game, connected };
    const fresh =
      old.connected && connected
        ? carcassonneCelebration(old.game, game)
        : null;
    if (
      !connected ||
      old.game.gameId !== game.gameId ||
      game.gameRevision !== old.game.gameRevision
    ) {
      if (timer.current) clearTimeout(timer.current);
      setEvent(fresh);
      if (fresh) timer.current = setTimeout(() => setEvent(null), 3200);
    }
  }, [game, connected]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return connected ? event : null;
}
