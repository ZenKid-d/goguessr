// Local persistence behind a small async interface. The browser build uses
// localStorage; Part C adds a Tauri/rusqlite backend selected by `getStorage()`
// when running inside Tauri. Keeping it async means swapping backends is free.
import type { GameMode, GameSettings } from '../net/bindings';
import { TauriStorage } from './tauri';

/** A completed game, kept for the personal records / history list. */
export interface GameRecord {
  playedAt: number; // epoch ms
  mode: GameMode;
  rounds: number;
  totalScore: number;
  maxScore: number;
}

export interface Storage {
  loadSettings(): Promise<GameSettings | null>;
  saveSettings(settings: GameSettings): Promise<void>;
  addRecord(record: GameRecord): Promise<void>;
  listRecords(limit?: number): Promise<GameRecord[]>;
  bestScore(): Promise<number | null>;
}

const SETTINGS_KEY = 'geoguess.settings.v1';
const RECORDS_KEY = 'geoguess.records.v1';
const MAX_RECORDS = 100;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

class LocalStorageBackend implements Storage {
  async loadSettings(): Promise<GameSettings | null> {
    return safeParse<GameSettings | null>(localStorage.getItem(SETTINGS_KEY), null);
  }

  async saveSettings(settings: GameSettings): Promise<void> {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  async addRecord(record: GameRecord): Promise<void> {
    const all = safeParse<GameRecord[]>(localStorage.getItem(RECORDS_KEY), []);
    all.unshift(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all.slice(0, MAX_RECORDS)));
  }

  async listRecords(limit = 20): Promise<GameRecord[]> {
    return safeParse<GameRecord[]>(localStorage.getItem(RECORDS_KEY), []).slice(0, limit);
  }

  async bestScore(): Promise<number | null> {
    const all = safeParse<GameRecord[]>(localStorage.getItem(RECORDS_KEY), []);
    if (all.length === 0) return null;
    return all.reduce((max, r) => Math.max(max, r.totalScore), 0);
  }
}

/** True when running inside the Tauri WebView (vs. a plain browser). */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let instance: Storage | null = null;

/** The active storage backend (memoised): rusqlite under Tauri, else localStorage. */
export function getStorage(): Storage {
  if (!instance) {
    instance = isTauri() ? new TauriStorage() : new LocalStorageBackend();
  }
  return instance;
}
