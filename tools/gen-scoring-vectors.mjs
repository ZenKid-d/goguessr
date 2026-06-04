#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Generates data/scoring-vectors.json — the single source of truth that BOTH
// the TypeScript scorer (apps/client/src/lib/game) and the authoritative Rust
// scorer (apps/server/src/scoring.rs) are tested against. This is how we stop
// the two implementations from silently drifting apart.
//
// The formulae here are an exact transcription of the spec. Run via:
//   node tools/gen-scoring-vectors.mjs   (or: npm run gen:vectors)
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** @param {{lat:number,lng:number}} a @param {{lat:number,lng:number}} b */
function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** @param {number} distanceKm @param {number} scaleKm */
function score(distanceKm, scaleKm) {
  return Math.round(5000 * Math.exp(-distanceKm / scaleKm));
}

const pts = {
  paris: { lat: 48.8566, lng: 2.3522 },
  london: { lat: 51.5074, lng: -0.1278 },
  newYork: { lat: 40.7128, lng: -74.006 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  equator0: { lat: 0, lng: 0 },
  equator1: { lat: 0, lng: 1 },
  antipodeN: { lat: 89, lng: 0 },
  antipodeS: { lat: -89, lng: 0 },
};

const pairs = [
  ['paris', 'paris'], // identical → distance 0 → max score
  ['paris', 'london'],
  ['paris', 'newYork'],
  ['newYork', 'tokyo'],
  ['tokyo', 'sydney'],
  ['equator0', 'equator1'], // ~111.19 km (one degree of longitude at equator)
  ['antipodeN', 'antipodeS'], // ~19821 km (near-antipodal)
];

const scales = [2000, 1000, 500];

const cases = [];
for (const scaleKm of scales) {
  for (const [f, t] of pairs) {
    const from = pts[f];
    const to = pts[t];
    const distanceKm = haversineKm(from, to);
    cases.push({
      from_name: f,
      to_name: t,
      scale_km: scaleKm,
      from,
      to,
      distance_km: distanceKm,
      score: score(distanceKm, scaleKm),
    });
  }
}

const out = { max_score_per_round: 5000, cases };
const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'data', 'scoring-vectors.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${cases.length} scoring vectors → ${target}`);
