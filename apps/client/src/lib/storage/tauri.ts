// Storage backend that calls the Tauri (rusqlite) commands in src-tauri/src/lib.rs.
// Only used when running inside the Tauri WebView (see getStorage()).
import { invoke } from '@tauri-apps/api/core';
import type { GameRecord, Storage } from './index';
import type { GameSettings } from '../net/bindings';

export class TauriStorage implements Storage {
  async loadSettings(): Promise<GameSettings | null> {
    const json = await invoke<string | null>('load_settings');
    return json ? (JSON.parse(json) as GameSettings) : null;
  }

  async saveSettings(settings: GameSettings): Promise<void> {
    await invoke('save_settings', { value: JSON.stringify(settings) });
  }

  async addRecord(record: GameRecord): Promise<void> {
    await invoke('add_record', { record });
  }

  async listRecords(limit = 20): Promise<GameRecord[]> {
    return invoke<GameRecord[]>('list_records', { limit });
  }

  async bestScore(): Promise<number | null> {
    return invoke<number | null>('best_score');
  }
}
