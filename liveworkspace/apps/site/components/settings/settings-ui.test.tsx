import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileCard } from './ProfileCard';
import { Switch } from './SettingsPanel';

// The settings page's pieces (liveworkspace/docs/site.md "Your account"), as they render.

describe('Switch', () => {
  it('is a switch named by its row, with a 44px tap target', () => {
    const html = renderToStaticMarkup(
      <Switch checked labelledBy="l" describedBy="d" onChange={() => {}} />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-labelledby="l"');
    expect(html).toContain('touch-target');
  });
});

describe('ProfileCard', () => {
  const html = renderToStaticMarkup(
    <ProfileCard initial={{ id: 'user_a', name: 'Ada Lovelace', color: '#8b5cf6' }} />,
  );

  it('offers Automatic and the ten colours as one radio group, the stored one checked', () => {
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(11);
    expect(html).toMatch(/aria-checked="true" aria-label="Violet"/);
    expect(html).toContain('Presence colour');
  });

  it('shows the name as collaborators see it, both shades of the colour set', () => {
    expect(html).toContain('value="Ada Lovelace"');
    expect(html).toContain('How others see you');
    expect(html).toContain('>AL<');
    expect(html).toContain('--identity:#8b5cf6');
    expect(html).toContain('--identity-deep:#6d28d9');
  });
});
