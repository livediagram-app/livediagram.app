'use client';

import { useEffect } from 'react';

// The browser tab's title for a page whose title is only known at run time (a document's name, a form's heading).
// The static export ships the route's own metadata title ("livediagram"), and React can commit that <title> again
// after this page set its own: a document that hydrated fast kept the bare brand in its tab. So the title is set,
// then held: any later rewrite of the head's <title> is put back while the page wants this one. The observer fires
// only on a change to the head's title, and putting it back is a no-op when it already reads right.
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (!title) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
}
