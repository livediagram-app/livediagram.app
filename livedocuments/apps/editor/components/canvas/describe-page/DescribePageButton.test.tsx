// @vitest-environment jsdom
// docs/specs/007-editor/describe-a-page.md "The button" and "The dialog": an Editor's who is signed in, named for the
// tab's kind, disabled at the page limit; the host sending the open document's words and making the page through the
// view's newest page edits, marking it in Contents and saying what was made.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiSourceScope } from '@liveworkspace/workbench/components/ai/ai-source-scope';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { DescribePageButton } from './DescribePageButton';
import { DescribePageHost } from './DescribePageHost';

const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));
// The dialog's code loads once pressed; here at once.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Host(props: { kind: string; onClose: () => void }) {
      return (
        <div data-host={props.kind}>
          <button type="button" onClick={props.onClose}>
            Close Host
          </button>
        </div>
      );
    },
}));
type Chrome = {
  accountUserId: string | null;
  documentId: string | null;
  documentTeamId: string | null;
  activeTab: { id: string };
};
const chrome = vi.hoisted(() => ({
  value: {
    accountUserId: 'user_a',
    documentId: 'doc_1',
    documentTeamId: 'team_1',
    activeTab: { id: 't1' },
  } as Chrome,
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChromeStore: () => ({ get: () => chrome.value }),
}));
const toasts = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toasts }));
const drafted = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/page-drafts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/page-drafts')>()),
  draftPage: drafted,
}));
// The dialog stands in as a button that makes the page, to read what the host does.
const made = vi.hoisted(() => ({ result: null as Promise<boolean> | null }));
vi.mock('./DescribePageDialog', () => ({
  DescribePageDialog: ({ make }: { make: (p: string, s: AbortSignal) => Promise<boolean> }) => (
    <button
      type="button"
      onClick={() => {
        made.result = make('Pricing', new AbortController().signal);
      }}
    >
      Make It
    </button>
  ),
}));

function SignedIn({ on, children }: { on: boolean; children: React.ReactNode }) {
  useAiSourceScope(null, on);
  return <>{children}</>;
}

const contents = (over: Partial<PageContents> = {}) =>
  ({
    canAdd: true,
    full: false,
    lastPage: { id: 'p2', kind: 'slide' },
    current: 'p1',
    expectAdded: vi.fn(),
    ...over,
  }) as unknown as PageContents;
// With no argument, an edit that lands; `undefined` named, none (the page limit).
const view = (...add: unknown[]) =>
  ({
    edit: { addDraftedPage: add.length ? add[0] : vi.fn(() => true) },
  }) as unknown as PagesModeView;

beforeEach(() => {
  tracked.mockReset();
  toasts.success.mockReset();
  drafted.mockReset();
  made.result = null;
});
afterEach(cleanup);

describe('DescribePageButton', () => {
  it('is named for the kind, counts its open, and opens the dialog for that kind', () => {
    render(
      <SignedIn on>
        <DescribePageButton view={view()} contents={contents()} />
      </SignedIn>,
    );
    const button = screen.getByRole('button', { name: 'Describe a Slide with AI' });
    fireEvent.click(button);
    expect(tracked).toHaveBeenCalledWith('UI', 'Opened', 'DescribePage');
    expect(document.querySelector('[data-host="slide"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close Host' }));
    expect(document.querySelector('[data-host]')).toBeNull();
  });

  it('names the other kinds, and is disabled at the page limit', () => {
    render(
      <SignedIn on>
        <DescribePageButton
          view={view()}
          contents={contents({ lastPage: { id: 'c', kind: 'flashcard' } as never })}
        />
        <DescribePageButton view={view(undefined)} contents={contents({ full: true })} />
      </SignedIn>,
    );
    expect(screen.getByRole('button', { name: 'Describe a Card with AI' })).toBeTruthy();
    const full = screen.getByRole('button', { name: /^Describe a Slide: A tab holds up to/ });
    expect(full.hasAttribute('disabled')).toBe(true);
  });

  it('shows nothing to a guest, without Add Page, or with no page', () => {
    const { container } = render(
      <>
        <SignedIn on={false}>
          <DescribePageButton view={view()} contents={contents()} />
        </SignedIn>
      </>,
    );
    expect(container.innerHTML).toBe('');
    cleanup();
    const other = render(
      <SignedIn on>
        <DescribePageButton view={view()} contents={contents({ canAdd: false })} />
        <DescribePageButton view={view()} contents={contents({ lastPage: undefined })} />
      </SignedIn>,
    );
    expect(other.container.innerHTML).toBe('');
  });
});

describe('DescribePageHost', () => {
  const draft = { kind: 'layout', layout: 'agenda', label: 'Agenda', text: { title: 'Pricing' } };

  it('sends the open document’s words, makes the page after the page here and says what was made', async () => {
    drafted.mockResolvedValue({ draft, provider: 'built-in', model: 'm' });
    const add = vi.fn(() => true);
    const list = contents();
    render(<DescribePageHost kind="slide" view={view(add)} contents={list} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make It' }));
    expect(await made.result).toBe(true);
    expect(drafted.mock.calls[0]![1]).toEqual({
      prompt: 'Pricing',
      documentId: 'doc_1',
      tabId: 't1',
      kind: 'slide',
      teamId: 'team_1',
    });
    expect(list.expectAdded).toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(draft, expect.objectContaining({}), 'p1');
    expect(toasts.success).toHaveBeenCalledWith('Added a slide from the Agenda layout');
  });

  it('says an article by its kind, and makes nothing when the page cannot land', async () => {
    drafted.mockResolvedValue({
      draft: { kind: 'writing', markdown: 'x' },
      provider: 'b',
      model: 'm',
    });
    render(
      <DescribePageHost
        kind="article"
        view={view()}
        contents={contents({ current: undefined })}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make It' }));
    expect(await made.result).toBe(true);
    expect(toasts.success).toHaveBeenCalledWith('Added an article');
    cleanup();
    for (const v of [view(vi.fn(() => false)), view(undefined)]) {
      render(<DescribePageHost kind="slide" view={v} contents={contents()} onClose={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Make It' }));
      expect(await made.result).toBe(false);
      cleanup();
    }
  });

  it('asks nothing without an account or a document, and sends no team for a document in none', async () => {
    chrome.value = { ...chrome.value, accountUserId: null };
    render(
      <DescribePageHost kind="slide" view={view()} contents={contents()} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make It' }));
    expect(await made.result).toBe(false);
    expect(drafted).not.toHaveBeenCalled();
    cleanup();
    chrome.value = { ...chrome.value, accountUserId: 'user_a', documentTeamId: null };
    drafted.mockResolvedValue({ draft, provider: 'built-in', model: 'm' });
    render(
      <DescribePageHost kind="slide" view={view()} contents={contents()} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make It' }));
    await made.result;
    expect(drafted.mock.calls[0]![1]).not.toHaveProperty('teamId');
  });
});
