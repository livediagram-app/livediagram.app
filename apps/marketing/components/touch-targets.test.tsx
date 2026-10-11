import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS, sectionHighlights } from '@/lib/landing-content';
import { StoryBeat } from './StoryBeat';
import { TemplateGallery } from './TemplateGallery';

// The landing page on a touch screen (docs/specs/004-interface-design/touch-targets.md): a story beat's
// highlights stack as abutting 44px rows, and the template search reads at 16px so iOS does not zoom the
// page into it.

describe('landing page on a touch screen', () => {
  it("stacks each story beat's highlights as 44px rows with no gap", () => {
    const section = LANDING_SECTIONS[0]!;
    const html = renderToStaticMarkup(<StoryBeat section={section} index={0} />);
    const list = html.match(/<ul [^>]*aria-label="[^"]+ highlights"[^>]*>/)?.[0] ?? '';
    expect(list).toMatch(/\bpointer-coarse:gap-y-0\b/);
    const rows = [...html.matchAll(/<a [^>]*class="(group flex items-start[^"]*)"/g)].map(
      (m) => m[1]!,
    );
    expect(rows).toHaveLength(sectionHighlights(section).length);
    for (const c of rows) expect(c).toMatch(/\bpointer-coarse:py-3\b/);
  });

  it('draws the template search at 16px on a coarse pointer', () => {
    const html = renderToStaticMarkup(<TemplateGallery />);
    const input = html.match(/<input[^>]*id="template-gallery-search"[^>]*>/)?.[0] ?? '';
    expect(input).toMatch(/\bpointer-coarse:text-base\b/);
  });
});
