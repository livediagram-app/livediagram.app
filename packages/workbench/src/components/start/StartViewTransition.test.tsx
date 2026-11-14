// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { START_MODE_TRANSITION, StartViewTransition } from './StartViewTransition';

describe('StartViewTransition', () => {
  it('renders the start inside it, animated by the start-mode transition alone', () => {
    render(
      <StartViewTransition>
        <p>Start</p>
      </StartViewTransition>,
    );
    expect(screen.getByText('Start')).toBeTruthy();
    expect(START_MODE_TRANSITION).toBe('start-mode');
  });
});
