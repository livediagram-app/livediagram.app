'use client';

import { useState } from 'react';
import type { ShapeLibrary, ShapeLibraryItem } from '@livediagram/api-schema';
import { SearchInput } from '@/components/primitives/SearchInput';
import { useShapeLibraries } from '@/components/primitives/ShapeLibraryProvider';
import { LibraryShapeTile } from './LibraryShapeTile';

// The palette's My shapes (docs/specs/013-workspace/shape-libraries.md "Using a library: the
// palette"): one section per library, newest first, each a grid of its shapes; a search over library
// names and shape titles. The list comes from the shared provider.

type Section = { library: ShapeLibrary; shapes: { item: ShapeLibraryItem; title: string }[] };

/** The sections a query leaves: a library whose name matches shows whole. */
export function myShapesSections(libraries: readonly ShapeLibrary[], query: string): Section[] {
  const q = query.trim().toLowerCase();
  return libraries
    .map((library) => {
      const shapes = library.items.map((item, i) => ({
        item,
        title: item.title.trim() || `Shape ${i + 1}`,
      }));
      if (!q || library.name.toLowerCase().includes(q)) return { library, shapes };
      return { library, shapes: shapes.filter((s) => s.title.toLowerCase().includes(q)) };
    })
    .filter((section) => section.shapes.length > 0);
}

export function PaletteMyShapesTab({ onInsert }: { onInsert: (item: ShapeLibraryItem) => void }) {
  const { libraries } = useShapeLibraries();
  const [query, setQuery] = useState('');
  const sections = myShapesSections(libraries, query);
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search my shapes"
          ariaLabel="Search my shapes"
          clearAriaLabel="Clear the shape search"
          clearDescription="Clear the search over your shapes."
        />
      </div>
      {sections.length === 0 ? (
        <p className="px-1 py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          No shapes match
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto overflow-x-hidden">
          {sections.map(({ library, shapes }) => {
            const headingId = `my-shapes-${library.id}`;
            return (
              <section key={library.id} aria-labelledby={headingId}>
                <h3
                  id={headingId}
                  className="mb-1 truncate px-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                >
                  {library.name}
                </h3>
                <ul className="grid grid-cols-3 gap-1">
                  {shapes.map(({ item, title }) => (
                    <li key={item.id}>
                      <LibraryShapeTile
                        item={item}
                        title={title}
                        libraryId={library.id}
                        libraryName={library.name}
                        onInsert={onInsert}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
