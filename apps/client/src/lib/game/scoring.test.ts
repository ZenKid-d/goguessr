import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';
import { MAX_SCORE_PER_ROUND, scoreForDistanceKm } from './scoring';
import type { LatLng } from './types';

interface VectorCase {
  from_name: string;
  to_name: string;
  scale_km: number;
  from: LatLng;
  to: LatLng;
  distance_km: number;
  score: number;
}

/** Walk up from this file to find the repo-root `data/scoring-vectors.json`. */
function findVectors(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'data', 'scoring-vectors.json');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error('scoring-vectors.json not found; run `npm run gen:vectors`');
}

const vectors = JSON.parse(
  readFileSync(findVectors(dirname(fileURLToPath(import.meta.url))), 'utf8'),
) as { cases: VectorCase[] };

describe('scoring', () => {
  it('awards the maximum at zero distance', () => {
    expect(scoreForDistanceKm(0, 2000)).toBe(MAX_SCORE_PER_ROUND);
  });

  it('decays monotonically with distance', () => {
    const near = scoreForDistanceKm(10, 2000);
    const mid = scoreForDistanceKm(500, 2000);
    const far = scoreForDistanceKm(5000, 2000);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it('is stricter at a smaller scale', () => {
    expect(scoreForDistanceKm(500, 500)).toBeLessThan(scoreForDistanceKm(500, 2000));
  });

  it('matches the shared cross-language fixture (TS side of the contract)', () => {
    expect(vectors.cases.length).toBeGreaterThan(0);
    for (const c of vectors.cases) {
      const d = haversineKm(c.from, c.to);
      expect(d).toBeCloseTo(c.distance_km, 6);
      expect(scoreForDistanceKm(d, c.scale_km)).toBe(c.score);
    }
  });
});
