// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { ITEMS, SETUP, TYPES } from './plan-ai-fixtures';
import { resetPlanAiThreads } from './plan-ai-thread';

// The panel over the AI button (docs/specs/026-plan/plan-ai.md "The panel"): sign-in for a guest, each kind's empty
// state and suggestions, a Viewer's note, a turn's answer, its changes and its Undo, and a refusal.

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx.value }));
const plan = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan.value }));
vi.mock('@/components/sheets/sheet-store-client', () => ({
  sheetStoreOf: () => ({ workbook: () => null, writeAll: () => 'sheet_full' }),
  sheetRefusalMessage: (code: string) => `refused ${code}`,
}));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children, title }: { children: ReactNode; title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock('@liveworkspace/ask/composer', () => ({
  AskComposer: ({
    label,
    onAsk,
    onNewChat,
    pill,
  }: {
    label: string;
    onAsk: (q: string) => boolean;
    onNewChat: (() => void) | null;
    pill: ReactNode;
  }) => (
    <div>
      {pill}
      <button type="button" onClick={() => onAsk('Typed question')}>
        {label}
      </button>
      {onNewChat ? (
        <button type="button" onClick={onNewChat}>
          New Chat
        </button>
      ) : null}
    </div>
  ),
  AnswerWith: ({ onPick }: { onPick: (c: string) => void }) => (
    <button type="button" onClick={() => onPick('built-in')}>
      Pill
    </button>
  ),
  answeredBy: (provider: string | undefined) => (provider ? `By ${provider}` : null),
  askAiView: () => ({ using: 'built-in', key: null }),
  askAiChoiceStore: { set: vi.fn() },
  useAskAiChoice: () => 'auto',
}));
vi.mock('@liveworkspace/settings-ui/ai-source', () => ({
  useAiSource: () => ({ line: null, act: null }),
}));
vi.mock('@liveworkspace/workbench/components/ai/ai-source-scope', () => ({
  accountDoor: () => null,
  useEditorAiScope: () => ({ teamId: null }),
}));
vi.mock('@liveworkspace/workbench/components/chrome/auth-routes', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in', signUpHref: '/sign-up' }),
}));
vi.mock('@liveworkspace/workbench/lib/open-settings', () => ({ requestOpenSettings: vi.fn() }));
const tracked = vi.hoisted(() => [] as string[]);
vi.mock('@/lib/telemetry', () => ({ track: (...a: string[]) => tracked.push(a.join('·')) }));
const asked = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('./plan-ai-client', () => ({ askPlanAi: asked.fn }));

import { PlanAiPanel } from './PlanAiPanel';
import { PlanAiButton } from './PlanAiButton';
import { DraftRefusal } from '@/components/describe/draft-client';

afterEach(() => {
  cleanup();
  resetPlanAiThreads();
  asked.fn.mockReset();
  tracked.length = 0;
});

const boardTab = {
  id: 't1',
  name: 'Roadmap',
  kind: 'board',
  elements: [{ id: 'e1', type: 'shape', shape: 'plan-board', planBoard: SETUP }],
} as unknown as Tab;

function open(
  tab: Tab,
  over: Record<string, unknown> = {},
  planOver: Record<string, unknown> = {},
) {
  const undo = vi.fn();
  const moveItems = vi.fn();
  ctx.value = {
    accountUserId: 'u1',
    selfParticipant: { id: 'u1' },
    projectId: 'p1',
    activeTab: tab,
    tabs: [tab],
    isReadOnly: false,
    undo,
    forms: { changeForm: vi.fn(), renameForm: vi.fn() },
    planTabs: { changeDashboard: vi.fn() },
    sheetsBridge: null,
    ...over,
  };
  plan.value = {
    items: ITEMS,
    types: TYPES,
    canEditCards: true,
    addItems: vi.fn(async () => true),
    moveItems,
    patchItems: vi.fn(),
    trashItems: vi.fn(() => 1),
    ...planOver,
  };
  render(<PlanAiPanel onPopoverClose={() => {}} />);
  return { undo, moveItems };
}

describe('PlanAiPanel', () => {
  it('asks a guest to sign in', () => {
    open(boardTab, { accountUserId: null });
    expect(screen.getByText('Sign In to Use AI')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe('/sign-in');
  });

  it('says so on a tab it does not work on', () => {
    open({ id: 'c', name: 'Canvas', elements: [] });
    expect(screen.getByText('Open a Board, Sheet, Form or Dashboard')).toBeTruthy();
  });

  it.each([
    ['board', 'Which cards have no assignee?'],
    ['sheet', 'Make a chart of this data'],
    ['form', 'Make every question required'],
    ['dashboard', 'Add a row with two slots at the top'],
  ])('offers what to try on a %s tab', (kind, suggestion) => {
    open({ id: 't1', name: 'T', kind, elements: [] } as unknown as Tab, {
      planTabs: { changeDashboard: vi.fn() },
    });
    expect(screen.getByText('Ask or Tell AI')).toBeTruthy();
    expect(screen.getByText(suggestion)).toBeTruthy();
  });

  it('an Editor’s turn shows the answer and its changes, and Undo takes them back', async () => {
    asked.fn.mockResolvedValue({
      reply: 'Moved it.',
      changes: [{ op: 'move', item: '#1', status: 'Done' }],
      provider: 'built-in',
      dropped: 0,
      role: 'edit',
    });
    const { undo, moveItems } = open(boardTab);
    fireEvent.click(screen.getByText('Move every card that is due this week to the first column'));
    await screen.findByText('Moved it.');
    expect(moveItems).toHaveBeenCalled();
    expect(screen.getByText('1 Change')).toBeTruthy();
    expect(screen.getByText('By built-in')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Undone')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    fireEvent.click(screen.getByText('Pill'));
    expect(tracked).toContain('UI·Changed·AskAiBuiltIn');
    fireEvent.click(screen.getByText('New Chat'));
    expect(screen.getByText('Ask or Tell AI')).toBeTruthy();
  });

  it('a Viewer is told nothing changes, and their turn changes nothing', async () => {
    asked.fn.mockResolvedValue({
      reply: 'Two cards.',
      changes: [{ op: 'move', item: '#1', status: 'Done' }],
      dropped: 0,
      provider: 'built-in',
      role: 'view',
    });
    const { moveItems } = open(boardTab, { isReadOnly: true }, { canEditCards: false });
    expect(screen.getByText('You Can View This Plan')).toBeTruthy();
    fireEvent.click(screen.getByText('Ask about this board'));
    // A change came back for a Viewer: left out, said so, and the words that claim it not shown.
    await screen.findByText('Nothing was changed.');
    expect(screen.getByText('You can view this tab, not change it.')).toBeTruthy();
    expect(moveItems).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('shows a refusal in its words, with Try Again', async () => {
    asked.fn.mockRejectedValueOnce(
      new DraftRefusal(429, 'ask_built_in_limit', 'Used up for today.'),
    );
    open(boardTab);
    fireEvent.click(screen.getByText('Ask or tell AI about this board'));
    await screen.findByText('Used up for today.');
    asked.fn.mockResolvedValue({
      reply: 'Fine.',
      changes: [],
      dropped: 0,
      provider: 'built-in',
      role: 'edit',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByText('Fine.')).toBeTruthy());
  });
});

describe('PlanAiButton', () => {
  it('opens Plan AI from the cluster', () => {
    const onToggle = vi.fn();
    render(<PlanAiButton open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open AI' }));
    expect(onToggle).toHaveBeenCalled();
  });
});
