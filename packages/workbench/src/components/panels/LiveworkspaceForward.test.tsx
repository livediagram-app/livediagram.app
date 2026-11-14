// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveworkspaceForward } from './LiveworkspaceForward';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function forward() {
  const replace = vi.fn();
  vi.spyOn(window, 'location', 'get').mockReturnValue({
    search: '?token=abc',
    replace,
  } as unknown as Location);
  render(<LiveworkspaceForward path="/join" title="Teams" body="Moved." cta="Join" />);
  return replace;
}

// liveworkspace/docs/specs/003-accounts/accounts.md "The join link": an old link forwards with its query.
describe('LiveworkspaceForward', () => {
  it('forwards to the accounts site named for the build, query and all, with the card as the fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNTS_SITE_URL', 'https://staging.example.test/');
    const replace = forward();
    expect(replace).toHaveBeenCalledWith('https://staging.example.test/join?token=abc');
    expect(screen.getByRole('link', { name: /Join/ }).getAttribute('href')).toBe(
      'https://staging.example.test/join?token=abc',
    );
  });

  it('forwards to liveworkspace.app when the build names no accounts site', () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNTS_SITE_URL', '');
    const replace = forward();
    expect(replace.mock.calls[0]![0]).toMatch(/\/join\?token=abc$/);
  });

  it('renders the card without the query on the server, where there is no location', () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNTS_SITE_URL', 'https://staging.example.test');
    const html = renderToString(
      <LiveworkspaceForward path="/join" title="Teams" body="Moved." cta="Join" />,
    );
    expect(html).toContain('href="https://staging.example.test/join"');
  });
});
