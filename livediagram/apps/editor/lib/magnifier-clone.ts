// The Magnifier's copy of the canvas (docs/specs/008-canvas/magnifier.md "Performance"): the drawn layer cloned
// as it stands, for the lens to show enlarged. A clone, not a second React render: it costs one DOM copy per change
// of the elements, and nothing per pointer move.
//
// An embedded frame or a video would load a second time in the copy, so a still box of the same size and place
// stands in for each. The copy is placed after the real layer in the document, so a lookup by id or an SVG
// `url(#id)` still finds the original first.

const STAND_IN_SELECTOR = 'iframe, video, object, embed';

export function cloneCanvasLayer(layer: HTMLElement): HTMLElement {
  const copy = layer.cloneNode(true) as HTMLElement;
  for (const heavy of copy.querySelectorAll<HTMLElement>(STAND_IN_SELECTOR)) {
    const box = document.createElement('div');
    const className = heavy.getAttribute('class');
    const style = heavy.getAttribute('style');
    if (className) box.setAttribute('class', className);
    if (style) box.setAttribute('style', style);
    for (const dimension of ['width', 'height'] as const) {
      const value = heavy.getAttribute(dimension);
      if (value) box.style[dimension] = /^\d+$/.test(value) ? `${value}px` : value;
    }
    box.style.background = 'rgba(100, 116, 139, 0.18)';
    heavy.replaceWith(box);
  }
  // A view, never a target: nothing in the copy takes focus, a press or a screen reader's attention.
  copy.removeAttribute('data-canvas-content');
  copy.setAttribute('data-magnifier-copy', '');
  copy.setAttribute('aria-hidden', 'true');
  copy.style.pointerEvents = 'none';
  return copy;
}
