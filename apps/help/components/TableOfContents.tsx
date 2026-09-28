'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { GlyphDisc } from '@livediagram/ui';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const HEADINGS = '.prose-help h2, .prose-help h3';

const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// The article's headings are an external store: the MDX article renders beside this component, so there
// is no render-time source, and they exist only once the article has committed (on a client-side
// navigation that commit can come after this list mounts). The store is the DOM, watched for added or
// removed nodes; a snapshot is kept per content, so an unchanged article is the same array. The server and
// hydration snapshot is empty. One heading is no table of contents.
const NO_ITEMS: TocItem[] = [];
let cachedKey = '[]';
let cachedItems = NO_ITEMS;

function readToc(): TocItem[] {
  const items: TocItem[] = [];
  document.querySelectorAll(HEADINGS).forEach((heading) => {
    const text = heading.textContent?.trim() ?? '';
    if (text)
      items.push({ id: heading.id || slugOf(text), text, level: heading.tagName === 'H2' ? 2 : 3 });
  });
  const list = items.length > 1 ? items : NO_ITEMS;
  const key = JSON.stringify(list);
  if (key !== cachedKey) {
    cachedKey = key;
    cachedItems = list;
  }
  return cachedItems;
}

function subscribeToArticle(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

const readNothing = () => NO_ITEMS;

export function TableOfContents() {
  const items = useSyncExternalStore(subscribeToArticle, readToc, readNothing);

  // The links need anchors: every listed heading without an id gets the one its link already uses.
  useLayoutEffect(() => {
    document.querySelectorAll(HEADINGS).forEach((heading) => {
      const text = heading.textContent?.trim() ?? '';
      if (text && !heading.id) heading.id = slugOf(text);
    });
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Contents
      </h3>
      <p className="mb-3 text-[11px] text-slate-400">Sections in this article</p>
      <ul className="space-y-1.5">
        {items.map((item, idx) => {
          const h2Index = items.slice(0, idx + 1).filter((i) => i.level === 2).length;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`flex items-center gap-2.5 py-1 text-sm transition-colors hover:text-brand-700 dark:hover:text-brand-200 ${
                  item.level === 3
                    ? 'pl-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {item.level === 2 && (
                  <GlyphDisc
                    size={20}
                    className="mr-2 bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                  >
                    {h2Index}
                  </GlyphDisc>
                )}
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
