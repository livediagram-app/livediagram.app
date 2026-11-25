// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// liveworkspace/docs/specs/010-site/site.md "Build with AI": the shared page, bound to the one MCP, with the site's
// header and footer, the cross-app art and a card for each app it reaches.
vi.mock('next/navigation', () => ({ usePathname: () => '/ai' }));

const { default: BuildWithAiPage, metadata } = await import('./page');

beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);
afterEach(() => vi.unstubAllGlobals());

describe('/ai', () => {
  it('is the shared page in the platform slate, with the one address and every app', () => {
    const { container } = render(<BuildWithAiPage />);
    expect(container.querySelector('[data-platform-ramp] main')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your AI, building in liveworkspace' }),
    ).toBeTruthy();
    expect(screen.getAllByText('https://mcp.liveworkspace.app/mcp').length).toBeGreaterThan(0);
    expect(screen.getByText(/keep every app you want ticked/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Every app, one connection' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Prompts That Cross Apps' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Create a free account' }).getAttribute('href')).toBe(
      '/sign-up',
    );
    expect(
      screen.getByRole('img', { name: /across liveplanner, livediagram and livedocuments/ }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'In every app' })).toBeTruthy();
    const footer = container.querySelector('footer')!;
    expect(within(footer).getByRole('link', { name: 'Build with AI' }).getAttribute('href')).toBe(
      '/ai',
    );
  });

  it('speaks for itself when shared', () => {
    expect(metadata.title).toBe('Build with AI · liveworkspace');
    expect(metadata.alternates?.canonical).toBe('/ai');
    expect((metadata.description ?? '').length).toBeLessThanOrEqual(160);
  });
});
