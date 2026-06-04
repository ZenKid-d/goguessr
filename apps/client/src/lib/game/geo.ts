import type { LatLng } from './types';

/**
 * Great-circle distance between two points in kilometres (haversine, R=6371).
 *
 * Must stay numerically identical to the Rust scorer in
 * `apps/server/src/scoring.rs`; both are pinned to `data/scoring-vectors.json`.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
