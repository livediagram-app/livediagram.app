// Scrolls `el` to the top of its own scroll container, and nothing else. `scrollIntoView`
// scrolls EVERY scrollable ancestor, the page included: inside a modal it nudged the document
// under the fixed header too, and the modal shifted up behind it and stayed there. This scrolls
// only the nearest ancestor that scrolls; with none (a page that scrolls itself, like /new on a
// phone) it scrolls the page.
export function scrollToTopWithin(el: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  const container = scrollParent(el);
  if (container) {
    const top =
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top, behavior });
    return;
  }
  const page = document.scrollingElement ?? document.documentElement;
  page.scrollTo({ top: el.getBoundingClientRect().top + page.scrollTop, behavior });
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}
