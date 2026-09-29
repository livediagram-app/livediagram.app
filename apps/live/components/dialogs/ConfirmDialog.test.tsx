// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

const show = (variant: 'danger' | 'warning' | 'neutral') =>
  render(
    <ConfirmDialog
      open
      title="t"
      message="m"
      confirmLabel="Go"
      variant={variant}
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  );

describe('ConfirmDialog confirm button', () => {
  it('is rose for danger, amber for warning, brand for neutral', () => {
    show('danger');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-rose-600');
    cleanup();
    show('warning');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-amber-400');
    cleanup();
    show('neutral');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-brand-500');
  });
});
