// The mini view's look (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint: space-mini-view.md): a
// Picture-in-Picture window opens blank, so the opener's stylesheets, its `<html>` classes (the theme's `dark`) and
// inline custom properties are copied in once, as it opens. A linked sheet is linked again by its address (cached,
// and its fonts resolve as they do here); an inline one is copied rule by rule.

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
  const html = to.documentElement;
  html.className = from.documentElement.className;
  const inline = from.documentElement.getAttribute('style');
  if (inline) html.setAttribute('style', inline);
  const lang = from.documentElement.lang;
  if (lang) html.lang = lang;
  html.style.colorScheme = from.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
