// @vitest-environment jsdom
// docs/specs/007-editor/describe-a-page.md "The dialog": named for the kind, an example filling the box, Make Slide and
// Ctrl / ⌘ Enter, busy and the slow line, the page made closing it, every refusal said in the api's fixed words with the
// words kept, a key's failure handed to the source line, and Cancel stopping the request.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESCRIBE_PAGE_FAILED,
  DESCRIBE_PAGE_NOT_ADDED,
  DESCRIBE_PAGE_SLOW,
  DESCRIBE_PAGE_SLOW_MS,
  DescribePageDialog,
  type MakePage,
} from './DescribePageDialog';
import { DESCRIBE_PAGE_WORDS } from './describe-page-words';
import { PageDraftRefusal } from '@/lib/api/page-drafts';

// The source line is the workbench's (its own tests); here, what the dialog hands it: the allowance and the failure.
vi.mock('@liveworkspace/workbench/components/ai/WorkbenchAiSource', () => ({
  WorkbenchAiSource: ({
    allowance,
    failure,
    id,
  }: {
    allowance?: string;
    failure?: { kind: string } | null;
    id?: string;
  }) => (
    <p id={id} data-ai-source-stub={failure ? failure.kind : 'none'}>
      {allowance}
    </p>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const open = (
  make: MakePage,
  kind: 'slide' | 'infographic' | 'article' | 'flashcard' = 'slide',
) => {
  const onClose = vi.fn();
  render(<DescribePageDialog kind={kind} make={make} onClose={onClose} />);
  return { onClose, box: screen.getByRole('textbox', { name: DESCRIBE_PAGE_WORDS[kind].title }) };
};

describe('DescribePageDialog', () => {
  it('is named for the kind, fills the box from an example, and makes the page from the words', async () => {
    const make = vi.fn<MakePage>(async () => true);
    const { onClose, box } = open(make);
    expect(screen.getByRole('heading', { name: 'Describe a Slide' })).toBeTruthy();
    expect(screen.getByText(/Counts toward your 30 built-in AI questions a day/)).toBeTruthy();
    const make_ = screen.getByRole('button', { name: 'Make Slide' });
    expect(make_.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    expect((box as HTMLTextAreaElement).value).toBe(DESCRIBE_PAGE_WORDS.slide.examples[0]!.text);
    fireEvent.click(make_);
    expect(await screen.findByRole('button', { name: 'Making…' })).toBeTruthy();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(make.mock.calls[0]![0]).toBe(DESCRIBE_PAGE_WORDS.slide.examples[0]!.text);
  });

  it('makes it on Ctrl or ⌘ Enter, for every kind', async () => {
    for (const kind of ['infographic', 'article', 'flashcard'] as const) {
      const make = vi.fn<MakePage>(async () => true);
      const { onClose, box } = open(make, kind);
      fireEvent.change(box, { target: { value: 'Something' } });
      fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
      cleanup();
    }
  });

  it('says a refusal in the api’s words and keeps the words; a key failure goes to the source line', async () => {
    const make = vi
      .fn<MakePage>()
      .mockRejectedValueOnce(
        new PageDraftRefusal(422, 'page_draft_off_topic', 'That doesn’t describe a slide.', null),
      )
      .mockRejectedValueOnce(
        new PageDraftRefusal(422, 'ai_key_failed', 'Claude did not accept the API key.', {
          source: 'account',
          provider: 'anthropic',
          kind: 'bad-key',
        }),
      )
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(false);
    const { onClose, box } = open(make);
    fireEvent.change(box, { target: { value: 'Hello' } });
    const go = () => fireEvent.click(screen.getByRole('button', { name: 'Make Slide' }));
    go();
    expect((await screen.findByRole('alert')).textContent).toBe('That doesn’t describe a slide.');
    expect((box as HTMLTextAreaElement).value).toBe('Hello');
    go();
    await screen.findByText('Claude did not accept the API key.');
    expect(document.querySelector('[data-ai-source-stub="bad-key"]')).toBeTruthy();
    go();
    expect(await screen.findByText(DESCRIBE_PAGE_FAILED)).toBeTruthy();
    go();
    expect(await screen.findByText(DESCRIBE_PAGE_NOT_ADDED)).toBeTruthy();
    // Typing again clears what was said.
    fireEvent.change(box, { target: { value: 'Hello again' } });
    expect(screen.queryByText(DESCRIBE_PAGE_NOT_ADDED)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('says it is still working after a while, and Cancel stops the request', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null = null;
    const make = vi.fn<MakePage>(
      (_p, s) =>
        new Promise((_resolve, reject) => {
          signal = s;
          s.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { onClose, box } = open(make);
    fireEvent.change(box, { target: { value: 'Slow one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Slide' }));
    expect(screen.queryByText(DESCRIBE_PAGE_SLOW)).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(DESCRIBE_PAGE_SLOW_MS);
    });
    expect(screen.getByText(DESCRIBE_PAGE_SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal!.aborted).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('drops an answer that comes after a cancel', async () => {
    let finish: (made: boolean) => void = () => {};
    const make = vi.fn<MakePage>(() => new Promise((resolve) => (finish = resolve)));
    const { onClose, box } = open(make);
    fireEvent.change(box, { target: { value: 'Late' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make Slide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
