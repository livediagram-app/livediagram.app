// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

const show = (variant: 'danger' | 'neutral') =>
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
  it('is rose for danger, brand for neutral', () => {
    show('danger');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-rose-600');
    cleanup();
    show('neutral');
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('bg-brand-500');
  });
});
