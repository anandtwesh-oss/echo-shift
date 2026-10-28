/* =========================================================
   systems/input.js  — Keyboard input manager
   Tracks which keys are currently held down for both players.
   Prevents default browser behaviour for gameplay keys.
   Clears all held keys when the window loses focus.
   ========================================================= */

// Keys that must not scroll the page or trigger browser shortcuts.
const PREVENTED_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', ' ', 'Enter',
]);

// Raw held-key state: key name → boolean
const _held = {};

function _onKeyDown(e) {
  if (PREVENTED_KEYS.has(e.key) || PREVENTED_KEYS.has(e.code)) {
    e.preventDefault();
  }
  _held[e.code] = true;
}

function _onKeyUp(e) {
  _held[e.code] = false;
}

function _onBlur() {
  // Release every key when the window loses focus so characters don't keep
  // moving after the user alt-tabs.
  for (const key in _held) {
    _held[key] = false;
  }
}

export function initInput() {
  window.addEventListener('keydown', _onKeyDown);
  window.addEventListener('keyup',   _onKeyUp);
  window.addEventListener('blur',    _onBlur);
}

/** Returns true while the given KeyboardEvent.code is held down. */
export function isHeld(code) {
  return _held[code] === true;
}

// Convenience bundles per player — imported by entities.
export const HeroKeys = {
  left:  'KeyA',
  right: 'KeyD',
  jump:  'KeyW',
  shoot: 'Space',
};

export const DevilKeys = {
  left:  'ArrowLeft',
  right: 'ArrowRight',
  jump:  'ArrowUp',
  shoot: 'Enter',
};

