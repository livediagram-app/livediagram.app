'use client';

import { useEffect } from 'react';

// Holds the browser tab's title at `title` while the page shows it. A plain `document.title =` in an effect is not
// enough on a page whose content arrives quickly (a form link's page reads its form in about 100ms): Next.js commits
// the route's metadata <title> a moment after hydration and writes the static title ("Form | liveplanner") back over
// it. So the title element is watched while mounted, and put back whenever something else rewrites it. One observer
// on one small element; its callback runs only when the title changes. null leaves the title alone.
export function useBrowserTabTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
