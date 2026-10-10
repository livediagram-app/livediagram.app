// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FeishuGlyph, GoogleGlyph } from './auth-glyphs';
import { ProviderAuthButton } from './auth-shared';

// The defect this pins: the button drew Google's mark unconditionally, so the
// self-hosted sign-in page's "Continue with Feishu" button showed a Google logo.
// A provider button draws the mark it is handed, and nothing else's.

const GOOGLE_BLUE = '#4285F4';
const FEISHU_BLUE = '#3370FF';

afterEach(cleanup);

describe('the provider marks', () => {
  it('draws each provider in its own colours', () => {
    const google = render(<GoogleGlyph />).container.innerHTML;
    expect(google).toContain(GOOGLE_BLUE);
    expect(google).not.toContain(FEISHU_BLUE);

    const feishu = render(<FeishuGlyph />).container.innerHTML;
    expect(feishu).toContain(FEISHU_BLUE);
    expect(feishu).not.toContain(GOOGLE_BLUE);
  });
});

describe('ProviderAuthButton', () => {
  const button = (glyph: ReactNode, label: string, loading = false) => (
    <ProviderAuthButton
      glyph={glyph}
      label={label}
      loading={loading}
      disabled={false}
      onClick={() => {}}
    />
  );

  it("draws the mark it is given, never another provider's", () => {
    const { container } = render(button(<FeishuGlyph />, 'Continue with Feishu'));
    expect(container.innerHTML).toContain(FEISHU_BLUE);
    expect(container.innerHTML).not.toContain(GOOGLE_BLUE);
    expect(screen.getByRole('button').textContent).toBe('Continue with Feishu');
  });

  it('says it is redirecting while the provider is being reached', () => {
    render(button(<FeishuGlyph />, 'Continue with Feishu', true));
    expect(screen.getByRole('button').textContent).toBe('Redirecting…');
  });
});
