// @vitest-environment jsdom
// subscription.md "What people see": each comparison row draws the logos of the apps it applies to, never
// liveworkspace's for a shared limit, each named for a screen reader and in a tooltip.
import { cleanup, render, screen } from '@testing-library/react';
import { limitRow, ROW_APPS } from '@liveworkspace/subscription';
import { afterEach, describe, expect, it } from 'vitest';
import { RowAppLogo, rowAppName } from './RowAppLogo';

afterEach(cleanup);

const names = () => screen.getAllByRole('img').map((img) => img.getAttribute('aria-label'));

describe('RowAppLogo', () => {
  it('draws one app’s mark, named', () => {
    render(<RowAppLogo apps={limitRow('callMinutesPerMonth').apps} />);
    expect(names()).toEqual(['livehuddle']);
    expect(rowAppName(limitRow('callMinutesPerMonth').apps)).toBe('livehuddle');
  });

  it('draws every app a shared limit applies to, each named, in a block three across', () => {
    const { container } = render(<RowAppLogo apps={limitRow('automationRunsPerMonth').apps} />);
    expect(names()).toEqual([...ROW_APPS]);
    expect(container.querySelector('.grid-cols-3')).not.toBeNull();
    expect(rowAppName(ROW_APPS)).toBe('Every app');
    cleanup();
    render(<RowAppLogo apps={limitRow('aiCreditsPerMonth').apps} />);
    expect(names()).toEqual(['livediagram', 'liveplanner', 'liveknowledge']);
  });
});
