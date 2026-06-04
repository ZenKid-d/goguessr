// Reactive wrapper around the pure solo engine: owns pool loading, the session
// state machine, and recording the result. The screen reads these getters.
import { maxScoreForGame } from '../game/scoring';
import { createSoloSession, nextRound, skipRound, submitGuess } from '../game/session';
import type { LatLng, SoloSessionState } from '../game/types';
import type { GameSettings } from '../net/bindings';
import { EmptyPoolError, loadPool, pickRounds } from '../pool';
import { getStorage } from '../storage';

let session = $state<SoloSessionState | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

function messageFor(e: unknown): string {
  if (e instanceof EmptyPoolError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong starting the game.';
}

export const solo = {
  get session(): SoloSessionState | null {
    return session;
  },
  get loading(): boolean {
    return loading;
  },
  get error(): string | null {
    return error;
  },

  /** Load the pool, pick rounds and begin. Returns false on failure (see error). */
  async start(gameSettings: GameSettings): Promise<boolean> {
    loading = true;
    error = null;
    session = null;
    try {
      const pool = await loadPool();
      const rounds = pickRounds(pool, gameSettings.rounds, gameSettings.region_filter);
      session = createSoloSession(gameSettings, rounds);
      return true;
    } catch (e) {
      error = messageFor(e);
      return false;
    } finally {
      loading = false;
    }
  },

  guess(g: LatLng): void {
    if (session?.phase === 'guessing') {
      session = submitGuess(session, g);
    }
  },

  skip(): void {
    if (session?.phase === 'guessing') {
      session = skipRound(session);
    }
  },

  advance(): void {
    if (!session) return;
    session = nextRound(session);
    if (session.phase === 'finished') {
      const finished = session;
      void getStorage().addRecord({
        playedAt: Date.now(),
        mode: finished.settings.mode,
        rounds: finished.settings.rounds,
        totalScore: finished.totalScore,
        maxScore: maxScoreForGame(finished.settings.rounds),
      });
    }
  },

  clear(): void {
    session = null;
    error = null;
  },
};
