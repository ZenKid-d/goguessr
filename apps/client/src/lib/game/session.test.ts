import { describe, expect, it } from 'vitest';
import {
  createSoloSession,
  currentSpec,
  lastOutcome,
  nextRound,
  roundNumber,
  submitGuess,
} from './session';
import type { RoundSpec } from './types';
import type { GameSettings } from '../net/bindings';

const settings: GameSettings = {
  rounds: 2,
  mode: 'Move',
  scale_km: 2000,
  time_limit_secs: 0,
  region_filter: null,
};

const rounds: RoundSpec[] = [
  { imageId: 'a', truth: { lat: 48.8566, lng: 2.3522 } },
  { imageId: 'b', truth: { lat: 51.5074, lng: -0.1278 } },
];

describe('solo session', () => {
  it('plays a 2-round game and accumulates score', () => {
    let s = createSoloSession(settings, rounds);
    expect(s.phase).toBe('guessing');
    expect(roundNumber(s)).toBe(1);
    expect(currentSpec(s).imageId).toBe('a');

    // Perfect guess in round 1.
    s = submitGuess(s, { lat: 48.8566, lng: 2.3522 });
    expect(s.phase).toBe('result');
    expect(lastOutcome(s)?.score).toBe(5000);

    s = nextRound(s);
    expect(s.phase).toBe('guessing');
    expect(roundNumber(s)).toBe(2);
    expect(currentSpec(s).imageId).toBe('b');

    // Far guess in round 2.
    s = submitGuess(s, { lat: 0, lng: 0 });
    expect(lastOutcome(s)?.score).toBeLessThan(5000);

    s = nextRound(s);
    expect(s.phase).toBe('finished');
    expect(s.totalScore).toBe(s.outcomes.reduce((acc, o) => acc + o.score, 0));
  });

  it('rejects an empty round list', () => {
    expect(() => createSoloSession(settings, [])).toThrow();
  });

  it('rejects guessing outside the guessing phase', () => {
    let s = createSoloSession(settings, rounds);
    s = submitGuess(s, { lat: 0, lng: 0 });
    expect(() => submitGuess(s, { lat: 1, lng: 1 })).toThrow();
  });
});
