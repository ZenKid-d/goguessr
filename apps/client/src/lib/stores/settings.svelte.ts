// Reactive game settings, persisted via the storage backend.
import { DEFAULT_SCALE_KM } from '../game/scoring';
import { getStorage } from '../storage';
import type { GameSettings } from '../net/bindings';

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 5,
  mode: 'Move',
  scale_km: DEFAULT_SCALE_KM,
  time_limit_secs: 0,
  region_filter: null,
};

let value = $state<GameSettings>({ ...DEFAULT_SETTINGS });

export const settings = {
  get value(): GameSettings {
    return value;
  },
  /** Merge a partial update and persist. */
  patch(p: Partial<GameSettings>): void {
    value = { ...value, ...p };
    void getStorage().saveSettings(value);
  },
  reset(): void {
    value = { ...DEFAULT_SETTINGS };
    void getStorage().saveSettings(value);
  },
  /** Load persisted settings (call once at startup). */
  async load(): Promise<void> {
    const stored = await getStorage().loadSettings();
    if (stored) {
      value = { ...DEFAULT_SETTINGS, ...stored };
    }
  },
};
