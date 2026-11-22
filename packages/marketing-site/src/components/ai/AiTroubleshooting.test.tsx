// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MAX_API_TOKENS_PER_ACCOUNT } from '@liveworkspace/api-schema/api-tokens';
import { AiTroubleshooting } from './AiTroubleshooting';

describe('AiTroubleshooting', () => {
  it('says the token cap the accounts Worker counts against, and where to free one', () => {
    const { container } = render(<AiTroubleshooting />);
    const text = container.textContent ?? '';
    expect(MAX_API_TOKENS_PER_ACCOUNT).toBe(20);
    expect(text).toContain(`You can have ${MAX_API_TOKENS_PER_ACCOUNT} unexpired tokens.`);
    expect(text).toContain('The approval page lists them');
    expect(text).not.toContain('ten unexpired');
  });
});
