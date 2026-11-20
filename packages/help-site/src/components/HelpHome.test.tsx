import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HelpClientProvider } from '../client';
import { CLIENT, SITE } from '../test/fixture';
import { HelpHome } from './HelpHome';

// A help home is the breadcrumb trail's root, so it draws no breadcrumb bar: the bar held only the Help icon, a link
// to the page already open (liveworkspace/docs/specs/017-help/help-centre.md "A home has no breadcrumb bar").
describe('HelpHome', () => {
  it('has no breadcrumb bar', () => {
    const html = renderToStaticMarkup(
      <HelpClientProvider value={CLIENT}>
        <HelpHome
          site={SITE}
          lede="Guides for the canvas."
          home={{
            sections: [],
            startHere: { walkthrough: 'canvas', steps: 2, beside: ['tools'] },
            stillStuck: { category: 'troubleshooting', contact: 'tools' },
            popular: [],
          }}
        />
      </HelpClientProvider>,
    );
    expect(html).toContain('How can we help?');
    expect(html).not.toContain('aria-label="Breadcrumb"');
  });
});
