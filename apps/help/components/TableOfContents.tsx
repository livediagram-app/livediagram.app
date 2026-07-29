'use client';

import { useState, useEffect } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    const headings = document.querySelectorAll('.prose-help h2, .prose-help h3');
    const tocItems: TocItem[] = [];

    headings.forEach((heading) => {
      const text = heading.textContent?.trim() ?? '';
      if (!text) return;

      if (!heading.id) {
        heading.id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      tocItems.push({
        id: heading.id,
        text,
        level: heading.tagName === 'H2' ? 2 : 3,
      });
    });

    if (tocItems.length > 1) {
      // The heading list only exists once the MDX article has rendered, so the
      // DOM is the external system being read here and there is no render-time
      // source to derive it from. Runs once on mount, so no render cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(tocItems);
    }
  }, []);

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
                className={`flex items-center gap-2.5 py-1 text-sm transition-colors hover:text-brand-700 ${
                  item.level === 3 ? 'pl-7 text-slate-400 hover:text-slate-600' : 'text-slate-600'
                }`}
              >
                {item.level === 2 && (
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {h2Index}
                  </span>
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
