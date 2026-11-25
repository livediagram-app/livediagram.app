// @vitest-environment jsdom
// Send to Knowledge Base's picker (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker"): only
// knowledgebases the person can edit, an existing page (at the end or under a heading) or a new page, the summary
// previewed with Insert, Edit and Cancel before anything is written, Add Without Summary, and the credits notice's way
// on when the month is used.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndexError, type KnowledgeSend } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock('../../hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { SendToKnowledgeDialog } from './SendToKnowledgeDialog';
import { KNOWLEDGE_MEMORY_KEY } from './knowledge-send-memory';
import type { KnowledgeCapture, KnowledgeSummaryAnswer } from './send-to-knowledge-entry';

const kb = (id: string, title: string, access: 'edit' | 'view' = 'edit') =>
  ({ id, title, access, app: 'liveknowledge' }) as never;
const sent = (over: Partial<KnowledgeSend> = {}): KnowledgeSend => ({
  id: 'ks_1',
  tabId: 't1',
  elementIds: ['a', 'b'],
  knowledgebase: { id: 'K', title: 'Team Wiki' },
  page: { id: 'p2', title: 'Payments' },
  link: 'https://www.liveknowledge.app/document/K#t=p2',
  at: 1,
  ...over,
});

function client(over: Record<string, unknown> = {}) {
  return {
    listItems: vi
      .fn()
      .mockResolvedValue({ items: [kb('K', 'Team Wiki'), kb('V', 'Read Only', 'view')] }),
    automationTarget: vi.fn().mockResolvedValue({
      app: 'liveknowledge',
      title: 'Team Wiki',
      pages: [
        { id: 'p1', name: 'Handbook', parent: null },
        { id: 'p2', name: 'Payments', parent: 'p1' },
      ],
    }),
    knowledgeOutline: vi.fn().mockResolvedValue({
      headings: [
        { id: 'h1', level: 2, text: 'Checkout' },
        { id: 'h2', level: 3, text: 'Cards' },
      ],
    }),
    sendToKnowledge: vi.fn().mockResolvedValue({ send: sent(), link: sent().link }),
    linkedTabs: vi.fn().mockResolvedValue({ source: 'can', target: 'can' }),
    linkTabs: vi.fn().mockResolvedValue({ source: 'made', target: 'made' }),
    ...over,
  };
}

const capture = (over: Partial<KnowledgeCapture> = {}): KnowledgeCapture => ({
  tabId: 't1',
  elementIds: ['a', 'b'],
  selection: {
    items: [
      { id: 'a', kind: 'shape', label: 'Cart' },
      { id: 'b', kind: 'shape', label: 'Payment' },
    ],
    links: [{ from: 'a', to: 'b' }],
  },
  heading: 'Checkout flow',
  picture: async () => ({ png: 'iVBORw0KGgo=', width: 40, height: 20 }),
  ...over,
});

const open = (
  c: ReturnType<typeof client>,
  summarise: (ask: unknown) => Promise<KnowledgeSummaryAnswer> = async () => ({
    ok: true,
    markdown: 'The cart hands the order to **payment**.',
  }),
  onClose = vi.fn(),
  cap = capture(),
) =>
  render(
    <SendToKnowledgeDialog
      capture={cap}
      source={{ app: 'livediagram', itemId: 'D' }}
      sourceTitle="Payments Flow"
      summarise={summarise}
      onClose={onClose}
      client={c as never}
    />,
  );

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

async function pickKbAndPage() {
  fireEvent.click(await screen.findByRole('button', { name: /Team Wiki/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Payments/ }));
}

describe('SendToKnowledgeDialog', () => {
  it('offers only knowledgebases the person can edit, and says what is sent', async () => {
    open(client());
    expect(await screen.findByRole('button', { name: /Team Wiki/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Read Only/ })).toBeNull();
    expect(screen.getByText('2 items, 1 arrow')).toBeTruthy();
  });

  it('writes with AI, previews, and inserts under a heading only when asked, remembering the knowledgebase', async () => {
    const c = client();
    const summarise = vi.fn(async (): Promise<KnowledgeSummaryAnswer> => ({
      ok: true,
      markdown: 'The cart pays.',
    }));
    const onClose = vi.fn();
    open(c, summarise, onClose);
    await pickKbAndPage();
    await waitFor(() =>
      expect(c.knowledgeOutline).toHaveBeenCalledWith('K', 'p2', expect.anything()),
    );
    const where = await screen.findByLabelText<HTMLSelectElement>('Where');
    await waitFor(() => expect(where.disabled).toBe(false));
    fireEvent.change(where, { target: { value: 'h1' } });
    fireEvent.change(await screen.findByLabelText(/Focus/), { target: { value: 'checkout' } });
    fireEvent.click(await screen.findByRole('button', { name: /Write With AI/ }));
    expect(await screen.findByRole('article', { name: 'Preview of the section' })).toBeTruthy();
    expect(summarise).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 't1', focus: 'checkout' }),
    );
    expect(c.sendToKnowledge).not.toHaveBeenCalled();
    expect(screen.getByText('The cart pays.')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(await screen.findByLabelText('Words (Markdown)'), {
      target: { value: 'The cart pays by card.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(await screen.findByText('The cart pays by card.')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(c.sendToKnowledge).toHaveBeenCalledWith({
      knowledgebase: 'K',
      place: { page: 'p2', after: 'h1' },
      heading: 'Checkout flow',
      markdown: 'The cart pays by card.',
      picture: { png: 'iVBORw0KGgo=', width: 40, height: 20 },
      source: { app: 'livediagram', itemId: 'D', tabId: 't1', elementIds: ['a', 'b'] },
    });
    expect(toast.success).toHaveBeenCalledWith('Added to Payments', expect.anything());
    expect(localStorage.getItem(KNOWLEDGE_MEMORY_KEY)).toContain('"kbId":"K"');
  });

  it('makes a new page under a parent, without a summary', async () => {
    const c = client();
    const summarise = vi.fn();
    open(c, summarise);
    fireEvent.click(await screen.findByRole('button', { name: /Team Wiki/ }));
    fireEvent.click(await screen.findByRole('button', { name: /New Page/ }));
    const parent = await screen.findByLabelText<HTMLSelectElement>('Parent');
    await waitFor(() => expect(parent.disabled).toBe(false));
    fireEvent.change(parent, { target: { value: 'p1' } });
    expect((await screen.findByLabelText<HTMLInputElement>('Title')).value).toBe('Payments Flow');
    fireEvent.click(await screen.findByRole('button', { name: 'Add Without Summary' }));
    expect(await screen.findByText('Cart')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(c.sendToKnowledge).toHaveBeenCalled());
    expect(c.sendToKnowledge.mock.calls[0]![0]).toMatchObject({
      place: { newPage: { title: 'Payments Flow', parent: 'p1' } },
      markdown: '- Cart\n- Payment\n\n1 arrow connects them.',
    });
    expect(summarise).not.toHaveBeenCalled();
  });

  it('Cancel in the preview writes nothing; Back keeps the form', async () => {
    const c = client();
    const onClose = vi.fn();
    open(c, undefined, onClose);
    await pickKbAndPage();
    fireEvent.click(await screen.findByRole('button', { name: /Write With AI/ }));
    await screen.findByRole('article', { name: 'Preview of the section' });
    fireEvent.click(await screen.findByRole('button', { name: /Back/ }));
    expect(
      (await screen.findByRole('button', { name: /Payments/ })).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(await screen.findByRole('button', { name: /Write With AI/ }));
    await screen.findByRole('article', { name: 'Preview of the section' });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(c.sendToKnowledge).not.toHaveBeenCalled();
  });

  it('with the month used, still adds the selection without a summary', async () => {
    const c = client();
    open(c, async () => ({
      ok: false,
      error: 'ai_credits_used',
      message: "This month's AI credits are used. You can still add the items without a summary.",
      limit: 'aiCreditsPerMonth',
      owner: 'p:user_owner',
    }));
    await pickKbAndPage();
    fireEvent.click(await screen.findByRole('button', { name: /Write With AI/ }));
    await screen.findByText(/AI credits are used/);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Without Summary' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(c.sendToKnowledge).toHaveBeenCalled());
    expect(c.sendToKnowledge.mock.calls[0]![0]).toMatchObject({
      markdown: '- Cart\n- Payment\n\n1 arrow connects them.',
    });
  });

  it('says a refused summary and a refused write plainly, and stays open', async () => {
    const c = client({
      sendToKnowledge: vi.fn().mockRejectedValue(
        new IndexError(422, 'knowledge_refused', null, null, null, {
          code: 'heading_unknown',
          reason: '',
        }),
      ),
    });
    const onClose = vi.fn();
    open(
      c,
      async () => ({ ok: false, error: 'summary_failed', message: "The AI couldn't write it." }),
      onClose,
    );
    await pickKbAndPage();
    fireEvent.click(await screen.findByRole('button', { name: /Write With AI/ }));
    expect((await screen.findByRole('alert')).textContent).toBe("The AI couldn't write it.");
    fireEvent.click(await screen.findByRole('button', { name: 'Add Without Summary' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/heading is no longer/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('goes without a picture it could not draw, and says so', async () => {
    const c = client();
    open(c, undefined, vi.fn(), capture({ picture: async () => null }));
    expect(await screen.findByText(/Too big to picture/)).toBeTruthy();
    await pickKbAndPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add Without Summary' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(c.sendToKnowledge).toHaveBeenCalled());
    expect(c.sendToKnowledge.mock.calls[0]![0]).not.toHaveProperty('picture');
  });
});

// Connect as tabs (connected-tabs.md "Linked from a Send to").
describe('connect as tabs', () => {
  it('links the source and the knowledgebase once the section is inserted', async () => {
    const c = client();
    const onClose = vi.fn();
    open(c, undefined, onClose);
    await pickKbAndPage();
    const row = await screen.findByRole('switch', { name: 'Connect as tabs' });
    await waitFor(() => expect(c.linkedTabs).toHaveBeenCalledWith('D', 'K', expect.anything()));
    expect(row.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(await screen.findByRole('button', { name: 'Add Without Summary' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() => expect(c.linkTabs).toHaveBeenCalledWith('D', 'K'));
  });

  it('cannot be switched on when neither file is the person’s to change', async () => {
    const c = client({
      linkedTabs: vi.fn().mockResolvedValue({ source: 'cannot', target: 'cannot' }),
    });
    open(c);
    await pickKbAndPage();
    const row = await screen.findByRole('switch', { name: 'Connect as tabs' });
    await waitFor(() => expect(row.hasAttribute('disabled')).toBe(true));
    expect(row.getAttribute('aria-checked')).toBe('false');
    expect(row.textContent).toContain('You can’t change the tabs of either file.');
  });
});
