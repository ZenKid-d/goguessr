// Builds data/locations.json from the Mapillary Graph API.
//
// For each seed (a world capital) we sample a handful of small bbox tiles
// (< 0.01°, the API's hard limit), query images, filter by quality / panorama,
// dedup by sequence, and keep a few per seed. Coverage varies wildly by country,
// so missing/empty seeds are skipped (never fatal) and reported at the end.
//
// Run:  MAPILLARY_TOKEN=MLY|... npm run build-pool
// Tunables (env): PER_SEED, TILES_PER_SEED, TILE_DEG, MIN_QUALITY, IMG_LIMIT,
//                 DELAY_MS, LIMIT_SEEDS, OUT, DRY_RUN
//
// Written in erasable TypeScript so `node --experimental-strip-types` runs it
// with no build step (no enums/namespaces/param-properties).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Seed {
  name: string;
  country: string;
  lat: number;
  lng: number;
  radius_km: number;
}

interface MapillaryImage {
  id: string;
  computed_geometry?: { type: string; coordinates: [number, number] };
  is_pano?: boolean;
  quality_score?: number;
  sequence?: string;
}

interface PoolLocation {
  id: string;
  lat: number;
  lng: number;
  country: string;
  seed: string;
  is_pano: boolean;
}

type Bbox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function envFloat(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const TOKEN = (process.env.MAPILLARY_TOKEN ?? '').trim();
const PER_SEED = envInt('PER_SEED', 3);
const TILES_PER_SEED = envInt('TILES_PER_SEED', 8);
const TILE_DEG = envFloat('TILE_DEG', 0.008); // must stay < 0.01
const MIN_QUALITY = envFloat('MIN_QUALITY', 0.2);
const IMG_LIMIT = envInt('IMG_LIMIT', 40);
const DELAY_MS = envInt('DELAY_MS', 120);
const LIMIT_SEEDS = envInt('LIMIT_SEEDS', 0); // 0 = all
const DRY_RUN = (process.env.DRY_RUN ?? '') !== '';
const OUT = process.env.OUT ?? join(REPO_ROOT, 'data', 'locations.json');
const SEEDS_PATH = join(HERE, '..', 'seeds.json');

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function loadSeeds(): Seed[] {
  const seeds = JSON.parse(readFileSync(SEEDS_PATH, 'utf8')) as Seed[];
  return LIMIT_SEEDS > 0 ? seeds.slice(0, LIMIT_SEEDS) : seeds;
}

/** `n` random small bbox tiles within the seed's radius. */
function makeTiles(seed: Seed, n: number, tileDeg: number): Bbox[] {
  const latSpan = seed.radius_km / 111;
  const lngSpan = seed.radius_km / (111 * Math.cos((seed.lat * Math.PI) / 180));
  const half = tileDeg / 2;
  const tiles: Bbox[] = [];
  for (let i = 0; i < n; i++) {
    const cLat = seed.lat + (Math.random() * 2 - 1) * latSpan;
    const cLng = seed.lng + (Math.random() * 2 - 1) * lngSpan;
    tiles.push([cLng - half, cLat - half, cLng + half, cLat + half]);
  }
  return tiles;
}

/** Fetch images in a bbox. Returns [] on transient errors; throws on auth failure. */
async function fetchTile(bbox: Bbox, seed: Seed): Promise<MapillaryImage[]> {
  if (DRY_RUN) {
    const lng = (bbox[0] + bbox[2]) / 2;
    const lat = (bbox[1] + bbox[3]) / 2;
    const key = `${seed.name}-${lng.toFixed(4)}-${lat.toFixed(4)}`;
    return [
      {
        id: `dry-${key}`,
        computed_geometry: { type: 'Point', coordinates: [lng, lat] },
        is_pano: true,
        quality_score: 0.9,
        sequence: `seq-${key}`,
      },
    ];
  }

  const fields = 'id,computed_geometry,is_pano,quality_score,sequence';
  const url =
    `https://graph.mapillary.com/images?fields=${fields}` +
    `&bbox=${bbox.join(',')}&limit=${IMG_LIMIT}&access_token=${encodeURIComponent(TOKEN)}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    console.warn(`    network error, skipping tile: ${(e as Error).message}`);
    return [];
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Mapillary auth failed (HTTP ${res.status}). Check MAPILLARY_TOKEN.`);
  }
  if (res.status === 429) {
    console.warn('    rate limited (429), backing off 2s');
    await sleep(2000);
    return [];
  }
  if (!res.ok) {
    console.warn(`    HTTP ${res.status}, skipping tile`);
    return [];
  }
  const json = (await res.json()) as { data?: MapillaryImage[] };
  return json.data ?? [];
}

function rankImages(
  images: MapillaryImage[],
  seen: Set<string>,
  sequences: Set<string>,
): MapillaryImage[] {
  return images
    .filter((im) => im.computed_geometry?.coordinates)
    .filter((im) => im.quality_score === undefined || im.quality_score >= MIN_QUALITY)
    .filter((im) => !seen.has(im.id))
    .filter((im) => !(im.sequence !== undefined && sequences.has(im.sequence)))
    .sort(
      (a, b) =>
        Number(Boolean(b.is_pano)) - Number(Boolean(a.is_pano)) ||
        (b.quality_score ?? 0) - (a.quality_score ?? 0),
    );
}

interface Coverage {
  seed: string;
  country: string;
  count: number;
}

async function collectForSeed(
  seed: Seed,
  seen: Set<string>,
  sequences: Set<string>,
): Promise<PoolLocation[]> {
  const collected: PoolLocation[] = [];
  for (const bbox of makeTiles(seed, TILES_PER_SEED, TILE_DEG)) {
    if (collected.length >= PER_SEED) break;
    const images = await fetchTile(bbox, seed);
    for (const im of rankImages(images, seen, sequences)) {
      if (collected.length >= PER_SEED) break;
      const [lng, lat] = im.computed_geometry!.coordinates;
      seen.add(im.id);
      if (im.sequence !== undefined) sequences.add(im.sequence);
      collected.push({
        id: im.id,
        lat,
        lng,
        country: seed.country,
        seed: seed.name,
        is_pano: Boolean(im.is_pano),
      });
    }
    if (!DRY_RUN) await sleep(DELAY_MS);
  }
  return collected;
}

function printReport(coverage: Coverage[], total: number): void {
  const withImages = coverage.filter((c) => c.count > 0);
  const empty = coverage.filter((c) => c.count === 0);
  console.log('\n── Coverage report ─────────────────────────────');
  for (const c of [...withImages].sort((a, b) => b.count - a.count)) {
    console.log(`  ${c.count.toString().padStart(3)}  ${c.seed} (${c.country})`);
  }
  console.log(`\n  seeds with imagery : ${withImages.length}/${coverage.length}`);
  console.log(`  total locations    : ${total}`);
  if (empty.length > 0) {
    const names = empty.map((c) => c.seed).join(', ');
    console.log(`  no coverage (${empty.length}): ${names}`);
  }
  console.log('────────────────────────────────────────────────\n');
}

async function main(): Promise<void> {
  if (!TOKEN && !DRY_RUN) {
    console.error('MAPILLARY_TOKEN is not set. Run: MAPILLARY_TOKEN=MLY|... npm run build-pool');
    process.exit(1);
  }

  const seeds = loadSeeds();
  console.log(
    `Building pool from ${seeds.length} seeds ` +
      `(per_seed=${PER_SEED}, tiles=${TILES_PER_SEED}, min_quality=${MIN_QUALITY}${DRY_RUN ? ', DRY_RUN' : ''})`,
  );

  const seen = new Set<string>();
  const sequences = new Set<string>();
  const locations: PoolLocation[] = [];
  const coverage: Coverage[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    process.stdout.write(`[${i + 1}/${seeds.length}] ${seed.name}… `);
    const found = await collectForSeed(seed, seen, sequences);
    locations.push(...found);
    coverage.push({ seed: seed.name, country: seed.country, count: found.length });
    console.log(`${found.length}`);
  }

  printReport(coverage, locations.length);

  if (locations.length === 0) {
    console.error('Collected 0 locations — not overwriting the pool. Check the token / coverage.');
    process.exit(1);
  }

  const out = {
    version: 1,
    generated_at: new Date().toISOString(),
    locations,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${locations.length} locations → ${OUT}`);
}

main().catch((e: unknown) => {
  console.error(`\nFatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
