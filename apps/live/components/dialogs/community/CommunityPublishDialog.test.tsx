// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// The publish dialog's validation (docs/specs/025-community/community.md "Publishing"): a problem is
// shown on its field, a failed submit takes the person there, and a worker refusal about a field lands
// on that field too, while one that is not sits in the footer.

vi.mock('@/lib/api-client', () => ({ apiCommunityPopularTags: vi.fn(async () => []) }));
vi.mock('./CommunityCardPreview', () => ({ CommunityCardPreview: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { ApiError } from '@/lib/api/core';
import { CommunityPublishDialog } from './CommunityPublishDialog';

beforeAll(() => {
  // jsdom has no layout: the dialog scrolls a field into view before focusing it.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const author = { name: 'Ada', color: '#f97316', picture: null };

function open(onPublish = vi.fn()) {
  render(
    <CommunityPublishDialog
      post={null}
      documentName="Birthday Card"
      ownerId="user_1"
      documentId="doc-1"
      author={author}
      onPublish={onPublish}
      onClose={() => {}}
    />,
  );
  return onPublish;
}

const description = () =>
  screen.getByRole('textbox', { name: /description/i }) as HTMLTextAreaElement;
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Share to Community' }));

describe('CommunityPublishDialog validation', () => {
  it('shows nothing until the first submit', () => {
    open();
    expect(screen.queryByText(/more characters/)).toBeNull();
    expect(description().getAttribute('aria-invalid')).toBeNull();
  });

  it('marks every field with a problem, says how to fix it, and focuses the first', () => {
    const onPublish = open();
    fireEvent.change(description(), { target: { value: 'Too short.' } });
    submit();
    expect(onPublish).not.toHaveBeenCalled();
    const message = screen.getByText('Add 10 more characters (at least 20).');
    expect(description().getAttribute('aria-invalid')).toBe('true');
    expect(description().getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.getByText('Choose the category that fits best.')).toBeTruthy();
    expect(document.activeElement).toBe(description());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('clears a message as soon as its field is fixed', () => {
    open();
    fireEvent.change(description(), { target: { value: 'Too short.' } });
    submit();
    fireEvent.change(description(), {
      target: { value: 'Long enough to describe the document well.' },
    });
    expect(screen.queryByText(/more characters/)).toBeNull();
    expect(description().getAttribute('aria-invalid')).toBeNull();
  });

  it('puts a worker field refusal on its field, and any other refusal in the footer', async () => {
    const onPublish = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('PublishCommunity', 400, 'invalid_description'))
      .mockRejectedValueOnce(new ApiError('PublishCommunity', 409, 'empty_document'));
    open(onPublish);
    fireEvent.change(description(), {
      target: { value: 'Long enough to describe the document well.' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Infographics/ }));
    submit();
    await waitFor(() => expect(description().getAttribute('aria-invalid')).toBe('true'));
    // Focus lands on it once the form is enabled again (it was disabled while saving).
    await waitFor(() => expect(document.activeElement).toBe(description()));
    expect((description() as HTMLTextAreaElement).disabled).toBe(false);
    submit();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Add something to your document before sharing it.',
    );
  });
});

describe('CommunityPublishDialog anonymous', () => {
  const fill = () => {
    fireEvent.change(description(), {
      target: { value: 'Long enough to describe the document well.' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Infographics/ }));
  };
  const toggle = () => screen.getByRole('switch', { name: /Share Anonymously/ });

  it('shares anonymously unless the author turns it off', async () => {
    const onPublish = vi.fn(async (_input: unknown) => ({ id: 'p1' }) as never);
    open(onPublish);
    fill();
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    submit();
    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    expect(onPublish.mock.calls[0]![0]).toMatchObject({ anonymous: true });
  });

  it('sends anonymous false once switched off', async () => {
    const onPublish = vi.fn(async (_input: unknown) => ({ id: 'p1' }) as never);
    open(onPublish);
    fill();
    fireEvent.click(toggle());
    submit();
    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    expect(onPublish.mock.calls[0]![0]).toMatchObject({ anonymous: false });
  });
});
