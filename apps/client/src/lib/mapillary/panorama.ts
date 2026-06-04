// Per-mode component configuration for the mapillary-js viewer.
//
// The three game modes map onto which interaction components are active:
//   Move  — navigate between images (sequence/direction) + look around.
//   NoMove — can't change image, but can pan + zoom within it.
//   NMPZ  — fully frozen: no move, no pan, no zoom.
//
// We also always hide the compass ("bearing"), which would leak orientation.
import type { Viewer } from 'mapillary-js';
import type { GameMode } from '../net/bindings';

const NAVIGATION = ['sequence', 'direction', 'keyboard'] as const; // change image
const LOOK = ['pointer', 'zoom'] as const; // pan + zoom within an image

/** Apply the component layout for `mode` to an existing viewer. Safe to re-run. */
export function applyMode(viewer: Viewer, mode: GameMode): void {
  // mapillary-js typings restrict component names to a union; we pass known
  // valid names but cast to string to keep this list data-driven.
  const v = viewer as unknown as {
    activateComponent(name: string): void;
    deactivateComponent(name: string): void;
  };
  const set = (name: string, on: boolean): void => {
    try {
      if (on) v.activateComponent(name);
      else v.deactivateComponent(name);
    } catch {
      // Component not present in this build — ignore.
    }
  };

  set('bearing', false);

  const canNavigate = mode === 'Move';
  const canLook = mode === 'Move' || mode === 'NoMove';

  for (const c of NAVIGATION) set(c, canNavigate);
  for (const c of LOOK) set(c, canLook);
}
