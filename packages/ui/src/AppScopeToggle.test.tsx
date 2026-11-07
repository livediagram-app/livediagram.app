// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppScopeToggle } from './AppScopeToggle';

// The "this app or All Apps" switch the Explorer and the Community page share (liveworkspace/docs/specs/010-site/
// site.md "The Explorer", "The Community"): two pressed-state buttons, each with its logo, telling only a change.
afterEach(cleanup);

function draw(value: 'app' | 'all', onChange = vi.fn()) {
  render(
    <AppScopeToggle
      value={value}
      onChange={onChange}
      app={{
        label: 'livediagram',
        logo: <svg data-testid="app-logo" />,
        description: 'Only canvases',
      }}
      all={{ label: 'All Apps', description: "Every app's items" }}
    />,
  );
  const [app, all] = within(screen.getByRole('group', { name: 'Show' })).getAllByRole('button');
  return { app: app!, all: all!, onChange };
}

describe('AppScopeToggle', () => {
  it('marks the side shown, with its label and logo', () => {
    const { app, all } = draw('app');
    expect(app.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(app.textContent).toBe('livediagram');
    expect(within(app).getByTestId('app-logo')).toBeTruthy();
    expect(all.textContent).toBe('All Apps');
    expect(app.className).toContain('cursor-pointer');
  });

  it('tells a change, and nothing for the side already shown', () => {
    const { app, all, onChange } = draw('app');
    fireEvent.click(app);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(all);
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
