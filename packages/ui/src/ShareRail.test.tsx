import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ShareRail } from './ShareRail';

describe('ShareRail', () => {
  // WCAG 1.4.3: the rail's label is text; slate 400 is 2.6:1 on its white card.
  it('labels the rail in a colour that meets AA in both appearances', () => {
    const label = /<span class="([^"]*)">Share<\/span>/.exec(renderToStaticMarkup(<ShareRail />));
    expect(label?.[1]).toContain('text-slate-500 dark:text-slate-400');
  });
});
