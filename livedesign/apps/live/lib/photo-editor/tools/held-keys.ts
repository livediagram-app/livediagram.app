// Whether Space is held now, for a marquee moved while it is drawn (docs/specs/031-photo/photo-tools.md
// "Selecting"). The listeners are put on once, on first asking, and never taken off: two flags' worth.
let space = false;
let installed = false;

function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'Space') space = true;
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.code === 'Space') space = false;
    },
    true,
  );
  window.addEventListener('blur', () => {
    space = false;
  });
}

export function spaceHeld(): boolean {
  install();
  return space;
}
