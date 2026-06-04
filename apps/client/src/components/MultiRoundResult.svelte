<script lang="ts">
  import { onMount } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { LngLatBounds, Map as MaplibreMap, Marker } from 'maplibre-gl';
  import { guessMapStyle } from '$lib/map/style';
  import { formatDistanceKm, formatScore } from '$lib/format';
  import type { Player } from '$lib/net/bindings';
  import type { RoundResultView } from '$lib/stores/multiplayer.svelte';

  interface Props {
    result: RoundResultView;
    players: Player[];
    myId: string | null;
  }
  let { result, players, myId }: Props = $props();

  const MINE = '#4ade80';
  const OTHER = '#60a5fa';
  const TRUTH = '#f87171';

  // Scoreboard rows: every player, with their result if they guessed.
  const rows = $derived(
    players
      .map((p) => {
        const r = result.results.find((x) => x.player_id === p.id);
        return {
          id: p.id,
          name: p.name,
          guessed: !!r,
          distanceKm: r?.distance_km ?? null,
          score: r?.score ?? 0,
        };
      })
      .sort((a, b) => b.score - a.score),
  );

  let container: HTMLDivElement;

  onMount(() => {
    const map = new MaplibreMap({
      container,
      style: guessMapStyle(),
      attributionControl: { compact: true },
      dragRotate: false,
    });

    map.on('load', () => {
      const bounds = new LngLatBounds();
      bounds.extend([result.trueLng, result.trueLat]);
      new Marker({ color: TRUTH }).setLngLat([result.trueLng, result.trueLat]).addTo(map);

      const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (const r of result.results) {
        const mine = r.player_id === myId;
        new Marker({ color: mine ? MINE : OTHER }).setLngLat([r.lng, r.lat]).addTo(map);
        bounds.extend([r.lng, r.lat]);
        lines.push({
          type: 'Feature',
          properties: { mine },
          geometry: {
            type: 'LineString',
            coordinates: [
              [r.lng, r.lat],
              [result.trueLng, result.trueLat],
            ],
          },
        });
      }

      map.addSource('guess-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: lines },
      });
      map.addLayer({
        id: 'guess-lines',
        type: 'line',
        source: 'guess-lines',
        paint: {
          'line-color': ['case', ['get', 'mine'], MINE, '#9aa6b8'],
          'line-width': ['case', ['get', 'mine'], 2.5, 1.5],
          'line-dasharray': [2, 2],
        },
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 56, maxZoom: 6, duration: 0 });
      }
    });

    const onResize = (): void => {
      map.resize();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
    };
  });
</script>

<div class="result">
  <div class="map" bind:this={container}></div>
  <ol class="board" aria-label="Round scores">
    {#each rows as row, i (row.id)}
      <li class:me={row.id === myId}>
        <span class="rank">{i + 1}</span>
        <span class="who"
          >{row.name}{#if row.id === myId}<span class="you"> (you)</span>{/if}</span
        >
        <span class="dist"
          >{row.guessed ? formatDistanceKm(row.distanceKm ?? NaN) : 'no guess'}</span
        >
        <span class="pts">+{formatScore(row.score)}</span>
      </li>
    {/each}
  </ol>
</div>

<style>
  .result {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
  .map {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  .board {
    list-style: none;
    margin: 0;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    background: var(--bg-elev);
    border-top: 1px solid var(--line);
    max-height: 38vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .board li {
    display: grid;
    grid-template-columns: 22px 1fr auto auto;
    gap: 10px;
    align-items: center;
    padding: 6px 4px;
  }
  .board li.me {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-radius: 8px;
  }
  .rank {
    color: var(--fg-muted);
    text-align: center;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .you {
    color: var(--fg-muted);
  }
  .dist {
    color: var(--fg-muted);
    font-size: 0.88rem;
  }
  .pts {
    font-weight: 700;
    min-width: 52px;
    text-align: right;
    color: var(--accent);
  }
</style>
