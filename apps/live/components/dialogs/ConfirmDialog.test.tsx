// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog confirm button', () => {
  // docs/specs/004-interface-design/destructive-actions.md: a delete is never painted red (or yellow).
  it('is the brand primary action, a Delete included', () => {
    render(
      <ConfirmDialog
        open
        title="t"
        message="m"
        confirmLabel="Delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    const cls = screen.getByRole('button', { name: 'Delete' }).className;
    expect(cls).toContain('bg-brand-500');
    expect(cls).not.toMatch(/rose|red-|amber/);
  });
});
