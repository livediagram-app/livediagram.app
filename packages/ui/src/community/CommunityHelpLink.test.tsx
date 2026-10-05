// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const siteTrack = vi.fn();
vi.mock('@livediagram/telemetry-client', () => ({
  siteTrack: (...a: unknown[]) => siteTrack(...a),
}));

import { CommunityHelpLink } from './CommunityHelpLink';

// A Community help deep link (docs/specs/018-help/contextual-help-links.md "Outside the editor: the Community").
afterEach(cleanup);

describe('CommunityHelpLink', () => {
  it('links the article and sends the help-link event', () => {
    render(<CommunityHelpLink article="finding">How Reports Work</CommunityHelpLink>);
    const link = screen.getByRole('link', { name: 'How Reports Work' });
    expect(link.getAttribute('href')).toBe(
      '/help/collaboration/sharing/finding-community-documents/',
    );
    fireEvent.click(link);
    expect(siteTrack).toHaveBeenCalledWith('UI', 'Opened', 'finding-community-documents');
  });

  it('reads on in a sentence, or stands as a secondary button, with the same link and event', () => {
    render(
      <p>
        Lead.{' '}
        <CommunityHelpLink article="finding" variant="inline">
          How the Community Works
        </CommunityHelpLink>
      </p>,
    );
    const inline = screen.getByRole('link', { name: 'How the Community Works' });
    expect(inline.querySelector('svg')).toBeNull();
    expect(inline.className).not.toContain('text-sm');
    render(
      <CommunityHelpLink article="sharing" variant="button">
        How Sharing Works
      </CommunityHelpLink>,
    );
    const button = screen.getByRole('link', { name: 'How Sharing Works' });
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.getAttribute('href')).toBe('/help/collaboration/sharing/community/');
    fireEvent.click(button);
    expect(siteTrack).toHaveBeenCalledWith('UI', 'Opened', 'community');
  });

  it('links the sharing article', () => {
    render(<CommunityHelpLink article="sharing">How Sharing Works</CommunityHelpLink>);
    expect(screen.getByRole('link', { name: 'How Sharing Works' }).getAttribute('href')).toBe(
      '/help/collaboration/sharing/community/',
    );
  });
});
