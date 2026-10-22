// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/forms-public', () => ({ reportForm: vi.fn() }));

import { FormFooter } from './FormFooter';

// docs/specs/030-forms/forms.md "Filling in a form": the made-with line and Report This Form under the card. On a 320px
// phone the line broke inside both ("Made / with", "Report This / Form"): each part stays whole, the line breaks
// between them, and the separator steps aside where it would dangle.
afterEach(cleanup);

describe('FormFooter', () => {
  it('keeps each part whole and wraps between them', () => {
    render(<FormFooter code="abc" />);
    const report = screen.getByRole('button', { name: 'Report This Form' });
    const row = report.parentElement!;
    expect(row.className).toContain('flex-wrap');
    expect(row.className).toContain('whitespace-nowrap');
    expect(row.querySelector(':scope > span[aria-hidden]')!.className).toContain(
      'max-[359px]:hidden',
    );
    expect(report.className).toContain('touch-target');
  });
});
