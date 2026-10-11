import { Children, isValidElement, type ReactNode } from 'react';

/**
 * Wraps article content and applies alternating full-width section
 * backgrounds: the children between <h2> boundaries are grouped into
 * section divs, and alternate sections get a tinted band that spans the
 * full viewport width.
 *
 * Grouped while rendering, so the static HTML already has its sections. It
 * used to regroup the DOM in an effect after hydration, which moved the whole
 * article down and right just after first paint (layout shift on every
 * article) and rebuilt nodes React owned. The MDX headings arrive here as
 * plain `h2` elements: the custom heading in mdx-components.tsx is a server
 * component, rendered before the content reaches this tree.
 */
export function SectionedContent({ children }: { children: ReactNode }) {
  const sections: ReactNode[][] = [[]];
  for (const node of Children.toArray(children)) {
    if (isValidElement(node) && node.type === 'h2') sections.push([node]);
    else sections[sections.length - 1]!.push(node);
  }

  return (
    <div className="prose-help">
      {sections.length < 2
        ? children
        : sections.map((sectionNodes, i) =>
            sectionNodes.length === 0 ? null : (
              <div
                key={i}
                className={
                  i === 0
                    ? 'article-intro'
                    : i % 2 === 0
                      ? 'article-section article-section-alt'
                      : 'article-section'
                }
              >
                {sectionNodes}
              </div>
            ),
          )}
    </div>
  );
}
