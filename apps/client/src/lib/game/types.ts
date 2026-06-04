// Pure game types. No UI, no framework — safe to use in solo logic, in the
// multiplayer client mirror, and in tests.
import type { GameMode, GameSettings } from '../net/bindings';

export type { GameMode, GameSettings };

/** A WGS84 coordinate. `lng` is x (longitude), `lat` is y (latitude). */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A single playable location.
 *
 * In SOLO the client holds the truth locally (it scores itself). In
 * MULTIPLAYER the server holds the truth and the client only ever learns
 * `imageId` until the round closes — so there `truth` is absent.
 */
export interface RoundSpec {
  imageId: string;
  truth: LatLng;
  country?: string;
}

/** The result of scoring one guess against one truth. */
export interface RoundOutcome {
  guess: LatLng;
  truth: LatLng;
  distanceKm: number;
  score: number;
  /** True when the round was skipped (image failed to load) — scores 0. */
  skipped?: boolean;
}

export type SoloPhase = 'guessing' | 'result' | 'finished';

/** Immutable snapshot of a solo game in progress. Mutated only via reducers. */
export interface SoloSessionState {
  settings: GameSettings;
  rounds: RoundSpec[];
  /** 0-based index of the active round. */
  currentRound: number;
  phase: SoloPhase;
  outcomes: RoundOutcome[];
  totalScore: number;
}
