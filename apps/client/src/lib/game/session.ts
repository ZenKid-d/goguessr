// Pure solo-game state machine. Reducers return NEW state (no mutation), so a
// runes-based store can wrap them and stay reactive. Reused conceptually by the
// multiplayer client, though there the server is authoritative for scoring.
import { haversineKm } from './geo';
import { scoreForDistanceKm } from './scoring';
import type { LatLng, RoundOutcome, RoundSpec, SoloSessionState } from './types';
import type { GameSettings } from '../net/bindings';

/** Begin a solo session over a fixed list of rounds. */
export function createSoloSession(settings: GameSettings, rounds: RoundSpec[]): SoloSessionState {
  if (rounds.length === 0) {
    throw new Error('createSoloSession: need at least one round');
  }
  return {
    settings,
    rounds,
    currentRound: 0,
    phase: 'guessing',
    outcomes: [],
    totalScore: 0,
  };
}

/** The round currently being played. Throws if the session has finished. */
export function currentSpec(state: SoloSessionState): RoundSpec {
  const spec = state.rounds[state.currentRound];
  if (!spec) {
    throw new Error(`currentSpec: no round at index ${state.currentRound}`);
  }
  return spec;
}

/** Lock in a guess for the current round and score it. Pure. */
export function submitGuess(state: SoloSessionState, guess: LatLng): SoloSessionState {
  if (state.phase !== 'guessing') {
    throw new Error(`submitGuess: not in guessing phase (was '${state.phase}')`);
  }
  const spec = currentSpec(state);
  const distanceKm = haversineKm(guess, spec.truth);
  const score = scoreForDistanceKm(distanceKm, state.settings.scale_km);
  const outcome: RoundOutcome = { guess, truth: spec.truth, distanceKm, score };
  return {
    ...state,
    phase: 'result',
    outcomes: [...state.outcomes, outcome],
    totalScore: state.totalScore + score,
  };
}

/** Skip the current round (e.g. its image won't load): records 0 points. Pure. */
export function skipRound(state: SoloSessionState): SoloSessionState {
  if (state.phase !== 'guessing') {
    throw new Error(`skipRound: not in guessing phase (was '${state.phase}')`);
  }
  const spec = currentSpec(state);
  const outcome: RoundOutcome = {
    guess: spec.truth,
    truth: spec.truth,
    distanceKm: 0,
    score: 0,
    skipped: true,
  };
  return {
    ...state,
    phase: 'result',
    outcomes: [...state.outcomes, outcome],
  };
}

/** Advance to the next round, or finish the game. Pure. */
export function nextRound(state: SoloSessionState): SoloSessionState {
  if (state.phase !== 'result') {
    throw new Error(`nextRound: not in result phase (was '${state.phase}')`);
  }
  const next = state.currentRound + 1;
  if (next >= state.rounds.length) {
    return { ...state, phase: 'finished' };
  }
  return { ...state, currentRound: next, phase: 'guessing' };
}

/** The most recently scored outcome, if any. */
export function lastOutcome(state: SoloSessionState): RoundOutcome | undefined {
  return state.outcomes[state.outcomes.length - 1];
}

/** Human-friendly 1-based round number for HUD display. */
export function roundNumber(state: SoloSessionState): number {
  return state.currentRound + 1;
}
