import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeroArt, type HeroArtManifest } from './HeroSheets';

afterEach(cleanup);

const sheet = (id: string, label: string): HeroArtManifest['sheets'][number] => ({
  id,
  label,
  light: [
    'div',
    { className: 'h-16 w-full', style: { backgroundColor: '#fff' } },
    ['span', null, `${label} light`],
  ],
  dark: ['div', { className: 'h-16 w-full' }, ['span', null, `${label} dark`]],
});

describe("Home's hero art from an app's manifest", () => {
  it('fans at most four sheets, each named, in both looks', () => {
    const art: HeroArtManifest = {
      app: 'liveplanner',
      label: 'What a plan can hold',
      sheets: ['Board', 'Sheet', 'Dashboard', 'Form', 'Extra'].map((l) =>
        sheet(l.toLowerCase(), l),
      ),
    };
    const { container, getByRole } = render(<HeroArt art={art} />);
    expect(getByRole('group', { name: 'What a plan can hold' })).toBeTruthy();
    const sheets = container.querySelectorAll('[data-hero-sheet]');
    expect([...sheets].map((s) => s.getAttribute('aria-label'))).toEqual([
      'Board',
      'Sheet',
      'Dashboard',
      'Form',
    ]);
    expect(container.textContent).toContain('Board light');
    expect(container.textContent).toContain('Board dark');
    expect(
      container.querySelector('[data-hero-sheet="board"] div')?.getAttribute('style'),
    ).toContain('background-color');
  });

  it('draws only boxes and shapes: no handlers, links, raw markup or outside pictures', () => {
    const art: HeroArtManifest = {
      app: 'x',
      label: 'Art',
      sheets: [
        {
          id: 'a',
          label: 'A',
          light: [
            'div',
            {
              onClick: 'alert(1)',
              dangerouslySetInnerHTML: { __html: '<b>raw</b>' },
              style: { backgroundImage: 'url(https://example.com/x.png)' },
            },
            ['script', null, 'alert(1)'],
            ['a', { href: 'javascript:alert(1)' }, 'link'],
            [
              'svg',
              { viewBox: '0 0 10 10' },
              ['image', { href: 'https://example.com/x.png' }],
              ['rect', { width: 5 }],
            ],
          ],
          dark: 'plain',
        },
      ],
    };
    const { container } = render(<HeroArt art={art} />);
    const html = container.innerHTML;
    expect(html).not.toContain('raw');
    expect(html).not.toContain('script');
    expect(html).not.toContain('link');
    expect(html).not.toContain('example.com');
    expect(html).not.toContain('onclick');
    expect(container.querySelector('rect')).toBeTruthy();
  });
});
