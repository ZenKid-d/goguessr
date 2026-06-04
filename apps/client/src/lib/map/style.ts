// Guess-map style. Default is free OSM raster tiles — labels (city/country
// names) are already baked into the imagery, so no second key is needed, as the
// original GeoGuessr guess map shows. A MapTiler key upgrades to labelled vector
// tiles.
import type { StyleSpecification } from 'maplibre-gl';
import { MAPTILER_KEY } from '../config';

const OSM_RASTER: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** A maplibre style: a MapTiler URL if a key is set, else the OSM raster spec. */
export function guessMapStyle(): StyleSpecification | string {
  if (MAPTILER_KEY) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
  }
  return OSM_RASTER;
}
