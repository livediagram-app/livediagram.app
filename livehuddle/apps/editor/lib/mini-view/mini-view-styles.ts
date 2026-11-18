// The mini view's look (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md): a
// Picture-in-Picture window opens blank, so the opener's stylesheets, its `<html>` classes (the theme's `dark`) and
// inline custom properties are copied in as it opens. A linked sheet is linked again by its address (cached, and its
// fonts resolve as they do here); an inline one is copied rule by rule. The `<html>` look is then followed while the
// window is open, so a theme switch (the app's Appearance setting, or the OS under System) reaches the open window
// too (Work Tracker 1110).

export function mirrorDocumentLook(from: Document, to: Document): void {
  for (const sheet of Array.from(from.styleSheets)) {
    if (sheet.href) {
      const link = to.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      to.head.appendChild(link);
      continue;
    }
    let text: string;
    try {
      text = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
    } catch {
      // An inline sheet always reads; nothing to copy if one ever does not.
      continue;
    }
    const style = to.createElement('style');
    style.textContent = text;
    to.head.appendChild(style);
  }
  mirrorRootLook(from, to);
}

/** The `<html>` element's look: its classes (the theme's `dark`), inline custom properties, language and colour scheme. */
export function mirrorRootLook(from: Document, to: Document): void {
  const html = to.documentElement;
  html.className = from.documentElement.className;
  const inline = from.documentElement.getAttribute('style');
  if (inline) html.setAttribute('style', inline);
  else html.removeAttribute('style');
  const lang = from.documentElement.lang;
  if (lang) html.lang = lang;
  else html.removeAttribute('lang');
  html.style.colorScheme = from.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** The `<html>` attributes a theme, scale or language change writes. */
const FOLLOWED_ATTRIBUTES = ['class', 'style', 'lang'];

/**
 * Keeps the window's `<html>` look in step with the opener's while it is open: one MutationObserver on the opener's
 * `<html>` attributes, so it fires only when the theme, scale or language changes, never per frame. Returns the stop.
 */
export function followRootLook(from: Document, to: Document): () => void {
  const observer = new MutationObserver(() => mirrorRootLook(from, to));
  observer.observe(from.documentElement, {
    attributes: true,
    attributeFilter: FOLLOWED_ATTRIBUTES,
  });
  return () => observer.disconnect();
}
