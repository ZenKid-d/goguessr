// Minimal screen router. A full router library is overkill for a handful of
// full-screen views in a mobile app; this is a single reactive value.
export type Screen = 'menu' | 'settings' | 'solo' | 'lobby' | 'multi';

let current = $state<Screen>('menu');

export const router = {
  get current(): Screen {
    return current;
  },
  go(screen: Screen): void {
    current = screen;
  },
};
