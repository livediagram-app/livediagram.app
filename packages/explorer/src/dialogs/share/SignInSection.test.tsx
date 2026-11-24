// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SHARE_SIGN_IN_OFF, type ShareSignInRule } from '@liveworkspace/index-client';
import { SignInSection } from './SignInSection';

// The section as the dialog holds it: the rule the index read back, set once a save is taken.
function Holder() {
  const [signIn, setSignIn] = useState<ShareSignInRule>(SHARE_SIGN_IN_OFF);
  return (
    <SignInSection
      signIn={signIn}
      busy={false}
      onSet={async (rule) => {
        // The index's answer comes back in a task of its own, as over the network.
        await new Promise((r) => setTimeout(r, 0));
        setSignIn(rule);
        return true;
      }}
    />
  );
}

describe('<SignInSection> domain box', () => {
  // The saved rule used to close the box from a passive effect, which could run a frame after a Change click had
  // opened it again and close it under the person (a CI flake on ShareDialogAccess, 2026-11-24).
  it('stays open when Change is pressed the moment a save lands', async () => {
    const { container } = render(<Holder />);
    fireEvent.click(screen.getByRole('switch', { name: /Anybody With Email Address Domain/ }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Email domains' }), {
      target: { value: 'acme.com' },
    });
    // As in a browser, not under act: the save's render commits in a task of its own, and Change is pressed in the
    // microtask after that commit draws the button, before React's next task (where a passive effect would run).
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasAct = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const pressed = new Promise<void>((resolve) => {
        const watch = new MutationObserver(() => {
          const change = screen.queryByRole('button', { name: 'Change Email Domains' });
          if (!change) return;
          watch.disconnect();
          fireEvent.click(change);
          resolve();
        });
        watch.observe(container, { childList: true, subtree: true });
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await pressed;
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = wasAct;
    }
    await act(async () => {});
    const box = (await screen.findByRole('textbox', { name: 'Email domains' })) as HTMLInputElement;
    expect(box.value).toBe('@acme.com');
  });

  it('closes an open box when another tab or person saves a rule', async () => {
    const { rerender } = render(
      <SignInSection signIn={SHARE_SIGN_IN_OFF} busy={false} onSet={async () => true} />,
    );
    fireEvent.click(screen.getByRole('switch', { name: /Anybody With Email Address Domain/ }));
    expect(await screen.findByRole('textbox', { name: 'Email domains' })).toBeTruthy();
    rerender(
      <SignInSection
        signIn={{ requireAccount: true, domains: ['acme.com'] }}
        busy={false}
        onSet={async () => true}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'Email domains' })).toBeNull();
    expect(await screen.findByRole('list', { name: 'Email domains' })).toBeTruthy();
  });
});
