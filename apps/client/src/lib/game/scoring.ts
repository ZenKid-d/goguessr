/** Maximum points awarded for a single round (a perfect guess). */
export const MAX_SCORE_PER_ROUND = 5000;

/** Default scoring decay scale in km (smaller = stricter). */
export const DEFAULT_SCALE_KM = 2000;

/**
 * Points for a guess `distanceKm` away, with difficulty `scaleKm`.
 * Exponential decay capped at {@link MAX_SCORE_PER_ROUND}.
 *
 * Mirrors `score_for_distance` in `apps/server/src/scoring.rs`.
 */
export function scoreForDistanceKm(distanceKm: number, scaleKm: number = DEFAULT_SCALE_KM): number {
  return Math.round(MAX_SCORE_PER_ROUND * Math.exp(-distanceKm / scaleKm));
}

/** The theoretical maximum total score for a game of `rounds` rounds. */
export function maxScoreForGame(rounds: number): number {
  return MAX_SCORE_PER_ROUND * rounds;
}
