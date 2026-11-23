// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GalleryLoading } from './GalleryLoading';

afterEach(cleanup);

describe('GalleryLoading', () => {
  it('is announced once as loading and draws two rows of tiles', () => {
    render(<GalleryLoading />);
    const status = screen.getByRole('status', { name: 'Loading images' });
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.children).toHaveLength(8);
  });

  it('draws as many tiles as asked', () => {
    render(<GalleryLoading tiles={4} />);
    expect(screen.getByRole('status').children).toHaveLength(4);
  });
});
