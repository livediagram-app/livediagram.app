// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeThisBrowser } from '@liveworkspace/explorer/this-browser';

// The editor at an archived plan's address (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): one this
// browser holds archived, or one the index refused as archived, shows the Plan Archived card in place of the editor,
// and its Change Folder goes to the Explorer's Archived, asking to move that plan. Anything else opens.

const harness = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  refusal: null as string | null,
}));
vi.mock('./useEditorState', () => ({ useEditorState: () => harness.state }));
vi.mock('@/lib/api/plan-grants', () => ({ planGrantRefusal: () => harness.refusal }));
vi.mock('./EditorView', () => ({ EditorView: () => <p>the editor</p> }));
vi.mock('@/components/dialogs/LocalMovePrompt', () => ({ LocalMovePrompt: () => null }));
vi.mock('@/components/dialogs/ConversionHandoff', () => ({ ConversionHandoff: () => null }));
vi.mock('@/components/chrome/EditorHeader', () => ({
  EditorHeader: ({ projectName }: { projectName: string }) => <h1>{projectName}</h1>,
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', () => ({
  ensureIconCatalogs: async () => {},
}));
vi.mock('@liveworkspace/workbench/lib/idle-prefetch', () => ({
  prefetchWhenIdle: () => undefined,
}));
// Every lazy status card: the archived card's Change Folder, the rest named alone.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Lazy(props: { archived?: { onChangeFolder?: () => void } }) {
      return props.archived ? (
        <button type="button" onClick={props.archived.onChangeFolder}>
          Change Folder
        </button>
      ) : (
        <p>a status card</p>
      );
    },
}));

const { default: LivePage } = await import('./editor-page');

const plan = (id: string, archivedAt: number | null) => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: null,
  trashedAt: null,
  favourite: false,
  archivedAt,
});

const assign = vi.fn();

beforeEach(() => {
  harness.state = {
    projectName: 'Plan',
    projectNotFound: false,
    loadError: null,
    sharePasswordGate: null,
    loadingProject: false,
    projectTrashed: { trashed: false },
    commentMentions: null,
    commentReactions: null,
  };
  harness.refusal = null;
  vi.stubGlobal('location', {
    ...window.location,
    pathname: '/project/p1',
    origin: 'https://liveplanner.app',
    assign,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  assign.mockClear();
});

describe('the editor at an archived plan', () => {
  it('shows the archived card for one this browser holds archived, and Change Folder asks to move it', () => {
    writeThisBrowser('liveplanner', [plan('p1', 5)]);
    render(<LivePage />);
    expect(screen.getByRole('heading', { name: 'Plan Archived' })).toBeTruthy();
    expect(screen.queryByText('the editor')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change Folder' }));
    expect(assign).toHaveBeenCalledWith('https://liveplanner.app/explorer/archived?move=p1');
  });

  it('shows it for one the index refused as archived', () => {
    harness.state = { ...harness.state, projectNotFound: true };
    harness.refusal = 'archived';
    render(<LivePage />);
    expect(screen.getByRole('heading', { name: 'Plan Archived' })).toBeTruthy();
  });

  it('opens one that isn’t archived, here or at the index', () => {
    writeThisBrowser('liveplanner', [plan('p1', null), plan('p2', 5)]);
    render(<LivePage />);
    expect(screen.getByText('the editor')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plan Archived' })).toBeNull();
  });
});
