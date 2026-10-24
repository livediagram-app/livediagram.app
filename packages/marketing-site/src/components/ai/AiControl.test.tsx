// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiControl } from './AiControl';

// docs/specs/019-marketing/build-with-ai.md "The page" 6: what keeps a connection in the person's control.
describe('AiControl', () => {
  it('says how long a connection lasts and where to revoke it', () => {
    render(<AiControl name="livediagram" />);
    expect(screen.getByText(/lasts six months/)).toBeTruthy();
    expect(screen.getByText(/Settings › Account › API Tokens/)).toBeTruthy();
  });
});
