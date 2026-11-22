// @vitest-environment jsdom

// A page a rule in another app wrote (docs/specs/013-workspace/automations.md "Steps in other apps"): the line says
// which rule and that nobody verified it, with Mark Verified for whoever may verify; gone once verified.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutomationWrittenBanner } from './AutomationWrittenBanner';

const stamp = {
  by: 'u1',
  at: 1,
  kind: 'human' as const,
  agent: 'Release Note in Launch',
  via: 'automation' as const,
};

describe('the Written by Automation line', () => {
  it('names the rule and verifies on Mark Verified', () => {
    const onVerify = vi.fn();
    render(<AutomationWrittenBanner stamp={stamp} verified={false} onVerify={onVerify} />);
    expect(screen.getByRole('note').textContent).toContain(
      'Written by the rule Release Note in Launch. Never verified.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Verified' }));
    expect(onVerify).toHaveBeenCalledOnce();
  });

  it('stands without the action for whoever may not verify, and is gone for any other page', () => {
    const { container, rerender } = render(
      <AutomationWrittenBanner stamp={{ ...stamp, agent: undefined }} verified={false} />,
    );
    expect(container.textContent).toBe('Written by the rule in another app. Never verified.');
    rerender(<AutomationWrittenBanner stamp={stamp} verified onVerify={() => {}} />);
    expect(container.innerHTML).toBe('');
    rerender(<AutomationWrittenBanner stamp={{ ...stamp, via: 'mcp' }} verified={false} />);
    expect(container.innerHTML).toBe('');
    rerender(<AutomationWrittenBanner stamp={undefined} verified={false} />);
    expect(container.innerHTML).toBe('');
  });
});
