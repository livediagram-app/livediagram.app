import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccountMenu } from './AccountMenu';
import { ACCOUNT_PALETTE } from './palette';
import { AccountMenuPlaceholder, DeferredAccountMenu } from './placeholder';

// The guard for palette.ts: the control's elements carry no `dark:` class of their own, so no stylesheet loaded
// after the site's can win a light/dark tie against them (the hovered row that turned pale in dark mode on the
// telemetry dashboard). Every colour that changes with the theme is a custom property the root sets, light and dark.

afterEach(cleanup);

const PALETTE = ACCOUNT_PALETTE.split(' ');
const LIGHT = new Map<string, string>();
const DARK = new Map<string, string>();
for (const token of PALETTE) {
  const match = /^(dark:)?\[(--account-[a-z-]+):(.+)\]$/.exec(token);
  expect(match, token).not.toBeNull();
  const [, dark, name, value] = match as RegExpExecArray;
  (dark ? DARK : LIGHT).set(name as string, value as string);
}

function classesIn(container: HTMLElement): string[] {
  const out = new Set<string>();
  for (const el of [container, ...container.querySelectorAll('*')]) {
    for (const token of (el.getAttribute('class') ?? '').split(/\s+/)) if (token) out.add(token);
  }
  return [...out];
}

function opened(ui: React.ReactElement): string[] {
  const { container } = render(ui);
  fireEvent.click(screen.getByRole('button', { name: /account menu$/ }));
  expect(screen.getByRole('menu')).toBeTruthy();
  return classesIn(container);
}

const signOut = async () => true;
const SURFACES: [string, () => string[]][] = [
  [
    'signed in, with the Explorer and the Settings panel',
    () =>
      opened(
        <AccountMenu
          name="Ada"
          explorerHref="/explorer"
          onSignOut={signOut}
          onOpenSettings={() => {}}
        />,
      ),
  ],
  ['signed in, Settings as a link', () => opened(<AccountMenu name="Ada" onSignOut={signOut} />)],
  [
    'a guest, with Settings',
    () =>
      opened(
        <AccountMenu
          guest={{ signInHref: '/sign-in', signUpHref: '/sign-up', onOpenSettings: () => {} }}
        />,
      ),
  ],
  ['the placeholder', () => classesIn(render(<AccountMenuPlaceholder />).container)],
  [
    'the deferred Guest button',
    () => classesIn(render(<DeferredAccountMenu load={() => new Promise(() => {})} />).container),
  ],
];

describe('the account palette', () => {
  it('gives every colour a light value and a dark one', () => {
    expect([...LIGHT.keys()].sort()).toEqual([...DARK.keys()].sort());
    for (const [name, light] of LIGHT) expect(DARK.get(name), name).not.toBe(light);
  });

  it('keeps the dark hover the menu has always had: slate-700 at 60% on the slate-800 surface', () => {
    expect(DARK.get('--account-hover')).toBe(
      'color-mix(in_oklab,var(--color-slate-700)_60%,transparent)',
    );
    expect(DARK.get('--account-surface')).toBe('var(--color-slate-800)');
    expect(LIGHT.get('--account-hover')).toBe('var(--color-slate-100)');
  });

  it.each(SURFACES)(
    '%s: no dark: class but the palette, and every colour it reads is defined',
    (_, classes) => {
      const all = classes();
      const ownDark = all.filter((token) => token.includes('dark:') && !PALETTE.includes(token));
      expect(ownDark).toEqual([]);
      for (const token of all) {
        for (const [, name] of token.matchAll(/\((--account-[a-z-]+)\)/g)) {
          expect(LIGHT.has(name as string), `${token} reads ${name}`).toBe(true);
        }
      }
      // The palette is set on the control's root, where every class that reads it sits below.
      expect(all).toContain(PALETTE[0]);
    },
  );

  // Tailwind v4's slate in sRGB (its oklch values, rounded to hex), for the WCAG ratio of a hovered row's hint.
  const SLATE: Record<string, string> = {
    'var(--color-slate-100)': '#f1f5f9',
    'var(--color-slate-500)': '#62748e',
    'var(--color-slate-600)': '#45556c',
  };
  function contrast(a: string, b: string): number {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  }

  it('darkens a hovered row’s hint to AA in light mode and keeps dark mode’s hint', () => {
    const hover = SLATE[LIGHT.get('--account-hover')!]!;
    // The resting hint on the hover fill is just under AA (4.35:1), the reason the token exists.
    expect(contrast(SLATE[LIGHT.get('--account-hint')!]!, hover)).toBeLessThan(4.5);
    expect(LIGHT.get('--account-hint-hover')).toBe('var(--color-slate-600)');
    expect(contrast(SLATE[LIGHT.get('--account-hint-hover')!]!, hover)).toBeGreaterThanOrEqual(4.5);
    expect(DARK.get('--account-hint-hover')).toBe(DARK.get('--account-hint'));
  });

  it('paints a hovered and a keyboard-focused item from the palette', () => {
    opened(<AccountMenu name="Ada" explorerHref="/explorer" onSignOut={signOut} />);
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.className).toContain('hover:bg-(--account-hover)');
      expect(item.className).toContain('focus-visible:bg-(--account-hover)');
      expect(item.className).not.toMatch(/(^|\s)(hover|focus-visible):bg-slate-/);
      // Its hints read the darker hover hint while it is hovered or focused.
      expect(item.className).toContain('hover:[--account-hint:var(--account-hint-hover)]');
      expect(item.className).toContain('focus-visible:[--account-hint:var(--account-hint-hover)]');
    }
  });
});
