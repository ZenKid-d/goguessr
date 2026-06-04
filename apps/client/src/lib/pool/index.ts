// Loads the solo location pool (served at /locations.json by the Vite plugin /
// bundled as a static asset) and selects rounds.
import type { RoundSpec } from '../game/types';

export interface PoolLocation {
  id: string;
  lat: number;
  lng: number;
  country: string;
  seed?: string;
  is_pano?: boolean;
}

export interface Pool {
  version: number;
  locations: PoolLocation[];
}

/** Thrown when the pool (or a filtered subset) has no usable locations. */
export class EmptyPoolError extends Error {
  constructor(message = 'The location pool is empty.') {
    super(message);
    this.name = 'EmptyPoolError';
  }
}

export async function loadPool(baseUrl: string = import.meta.env.BASE_URL): Promise<Pool> {
  const res = await fetch(`${baseUrl}locations.json`, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load location pool (HTTP ${res.status}).`);
  }
  const pool = (await res.json()) as Pool;
  if (!Array.isArray(pool.locations) || pool.locations.length === 0) {
    throw new EmptyPoolError();
  }
  return pool;
}

/** Distinct country names present in the pool, sorted for a filter dropdown. */
export function countriesIn(pool: Pool): string[] {
  return [...new Set(pool.locations.map((l) => l.country))].sort((a, b) => a.localeCompare(b));
}

/**
 * Pick `count` rounds at random, preferring true panoramas, optionally limited
 * to a single country. Sequences are not deduped here (the builder already does
 * that); we just shuffle and take.
 */
export function pickRounds(pool: Pool, count: number, regionFilter?: string | null): RoundSpec[] {
  const candidates = regionFilter
    ? pool.locations.filter((l) => l.country === regionFilter)
    : pool.locations;

  if (candidates.length === 0) {
    throw new EmptyPoolError(
      regionFilter ? `No locations available for "${regionFilter}".` : undefined,
    );
  }

  const shuffled = shuffle(candidates);
  const panos = shuffled.filter((l) => l.is_pano);
  const rest = shuffled.filter((l) => !l.is_pano);
  return [...panos, ...rest].slice(0, count).map(toRoundSpec);
}

function toRoundSpec(l: PoolLocation): RoundSpec {
  return { imageId: l.id, truth: { lat: l.lat, lng: l.lng }, country: l.country };
}

function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
