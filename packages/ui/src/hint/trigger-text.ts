// What a hint's trigger already says, read from the DOM.

const squeeze = (text: string): string => text.replace(/\s+/g, ' ').trim();

// Text a sighted person can see on the trigger. `innerText` honours layout
// (a caption hidden with display:none reads as empty); without layout
// (jsdom) fall back to the text nodes outside aria-hidden and sr-only.
export function hasVisibleText(el: Element): boolean {
  const rendered = (el as HTMLElement).innerText;
  if (typeof rendered === 'string') return squeeze(rendered) !== '';
  return squeeze(visibleTextContent(el)) !== '';
}

function visibleTextContent(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element)) return '';
  if (node.getAttribute('aria-hidden') === 'true' || node.classList.contains('sr-only')) return '';
  return Array.from(node.childNodes, visibleTextContent).join('');
}

// The trigger's accessible name, in the order assistive technology uses:
// aria-label, then aria-labelledby, then its own text.
export function accessibleNameOf(el: Element): string {
  const label = el.getAttribute('aria-label');
  if (label) return squeeze(label);
  const ids = el.getAttribute('aria-labelledby');
  if (ids) {
    const text = ids
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (squeeze(text)) return squeeze(text);
  }
  return squeeze(el.textContent ?? '');
}

// A tooltip says the same words the control carries (spec). Contained
// rather than equal, so clipped text and visually hidden prefixes pass (D8).
export function nameSaysLabel(name: string, label: string): boolean {
  return name.toLowerCase().includes(squeeze(label).toLowerCase());
}

// Text cut short by CSS (an ellipsis, a clipped box) somewhere in the trigger: its tooltip carries the rest.
function isClipped(el: Element): boolean {
  for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
    const box = node as HTMLElement;
    if (box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1) {
      if (box.clientWidth > 0 || box.clientHeight > 0) return true;
    }
  }
  return false;
}

// A trigger whose visible text already says the label, uncut, needs no tooltip: it would only cover what sits
// beside it (spec "When a control gets no tooltip").
export function showsOwnName(el: Element, label: string): boolean {
  const rendered = (el as HTMLElement).innerText;
  const text = squeeze(typeof rendered === 'string' ? rendered : visibleTextContent(el));
  if (text === '' || !nameSaysLabel(text, label)) return false;
  return !isClipped(el);
}
