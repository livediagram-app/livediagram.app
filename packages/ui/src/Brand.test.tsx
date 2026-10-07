// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Brand } from './Brand';

// The wordmark is a logotype (WCAG 1.4.3 sets logo text no contrast minimum); the contrast audits
// find it by its mark rather than by its classes.
describe('Brand', () => {
  it('marks its wordmark as a logotype', () => {
    const { container } = render(<Brand />);
    const wordmark = container.querySelector('[data-logotype]');
    expect(wordmark?.textContent).toBe('livediagram');
  });
});
