import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, planGlyphPath } from '@liveplanner/items';
import { inboxHost } from './inbox';

describe('the Inbox on liveworkspace.app', () => {
  it('draws a Plan card type by its own glyph', () => {
    const type = ITEM_TYPES[0]!;
    const html = renderToStaticMarkup(<>{inboxHost.cardGlyph!(type.id)}</>);
    expect(html).toContain(`d="${planGlyphPath(type.glyph)}"`);
  });

  it('draws the plain card glyph for a type not built in', () => {
    const html = renderToStaticMarkup(<>{inboxHost.cardGlyph!('made-up')}</>);
    expect(html).toContain(`d="${planGlyphPath(undefined)}"`);
  });

  it('points the actions help at liveplanner', () => {
    expect(inboxHost.actionsHelpHref).toMatch(/\/help\/plan\/cards\/$/);
  });
});
