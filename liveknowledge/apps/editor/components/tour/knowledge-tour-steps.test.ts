// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KNOWLEDGE_TOURS, KNOWLEDGE_TOUR_COPY, type TourWho } from '@/lib/knowledge-tours';
import { HELP_ARTICLES } from '@/lib/help-articles';
import { createKnowledgeTourApi, pick, type KnowledgeTourApi } from './knowledge-tour-dom';
import {
  KNOWLEDGE_TOUR_OUTROS,
  allKnowledgeTourSteps,
  knowledgeTourEyebrow,
  knowledgeTourSteps,
} from './knowledge-tour-steps';

// docs/specs/007-editor/knowledge-tours.md "The tours" and "Only what is there"; blueprint knowledge-tours.md
// "Testing": every step points at a control the editor really draws, for each role, and a reader is never pointed at
// a writer's control.

const ROLES: Record<string, TourWho> = {
  Editor: { write: true, share: true, signedIn: true, online: true, phone: false },
  Participant: { write: true, share: false, signedIn: true, online: true, phone: false },
  Viewer: { write: false, share: false, signedIn: true, online: true, phone: false },
  'Phone Editor': { write: true, share: true, signedIn: true, online: true, phone: true },
  'Offline Editor': { write: true, share: true, signedIn: true, online: false, phone: false },
};

// The app's and the shared packages' own markup, tours and tests left out: where every anchor must be drawn.
const ROOTS = [
  join(__dirname, '..'),
  join(__dirname, '..', '..', 'app'),
  join(__dirname, '..', '..', '..', '..', '..', 'packages', 'workbench', 'src'),
];
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'tour' && name !== 'node_modules') sources(path, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}
const MARKUP = ROOTS.flatMap((r) => sources(r))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// Each attribute a selector names, and the value it asks for: `[data-page-tree="rail"]` → data-page-tree, rail.
const attributesOf = (selector: string) =>
  [...selector.matchAll(/\[([a-z-]+)(?:="([^"]+)")?\]/g)].map((m) => ({
    name: m[1]!,
    value: m[2],
  }));

const api = (): KnowledgeTourApi => ({
  showView: vi.fn(),
  openTree: vi.fn(),
  openPageInfo: vi.fn(),
  tidy: vi.fn(),
});

// The controls only a writer is drawn (page-toolbar Edit, the meta Verify, a row's + and ⋯, New Page, the Trash).
const WRITERS_ONLY = [
  'data-page-edit',
  'data-meta-verify',
  'data-row-action',
  'data-new-page',
  'data-page-trash-row',
  'data-page-trash-rail',
  'data-request-approval',
  'data-page-comments',
];

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(Object.entries(ROLES))('as %s', (_role, who) => {
  it.each(KNOWLEDGE_TOURS)('anchors every step of %s on a control the editor draws', (id) => {
    for (const step of allKnowledgeTourSteps(id, who)) {
      const selector = step.selector?.(api()) ?? '';
      expect(selector, `${id}/${step.id}`).not.toBe('');
      expect(() => document.querySelectorAll(selector), `${id}/${step.id}`).not.toThrow();
      for (const { name, value } of attributesOf(selector)) {
        if (name === 'aria-label') {
          expect(MARKUP, `${id}/${step.id} ${value}`).toContain(value!);
          continue;
        }
        expect(MARKUP, `${id}/${step.id} ${name}`).toMatch(new RegExp(`${name}[=:\\s'"{}]`));
        if (value) expect(MARKUP, `${id}/${step.id} ${name}=${value}`).toContain(value);
      }
      if (!who.write)
        for (const { name } of attributesOf(selector))
          expect(WRITERS_ONLY, `${id}/${step.id}`).not.toContain(name);
    }
  });
});

describe('a run', () => {
  const editor = ROLES.Editor!;

  it('ends every tour on its closing card, which puts back what it opened', () => {
    for (const id of KNOWLEDGE_TOURS) {
      const steps = knowledgeTourSteps(id, editor, () => true);
      const last = steps.at(-1)!;
      expect(last.card, id).toBe('outro');
      expect(last.title, id).toBe(KNOWLEDGE_TOUR_OUTROS[id].title);
      const a = api();
      void last.prepare?.(a);
      expect(a.tidy).toHaveBeenCalledOnce();
      expect(steps.length - 1, id).toBeLessThanOrEqual(6);
    }
  });

  it('links each tour to a real help article', () => {
    for (const id of KNOWLEDGE_TOURS) {
      expect(HELP_ARTICLES[KNOWLEDGE_TOUR_COPY[id].help], id).toMatch(/^[a-z-]+\/[a-z-]+$/);
      expect(knowledgeTourEyebrow(id)).toBe(`${KNOWLEDGE_TOUR_COPY[id].title} tour`);
    }
  });

  it('opens each view by its tab and the tree before its steps', () => {
    const a = api();
    const steps = allKnowledgeTourSteps('organise', editor);
    void steps.find((s) => s.id === 'tree')!.prepare?.(a);
    expect(a.showView).toHaveBeenCalledWith('pages');
    expect(a.openTree).toHaveBeenCalled();
    void allKnowledgeTourSteps('connect', editor)
      .find((s) => s.id === 'apps')!
      .prepare?.(a);
    expect(a.showView).toHaveBeenCalledWith('connect');
    void allKnowledgeTourSteps('trust', editor)
      .find((s) => s.id === 'health')!
      .prepare?.(a);
    expect(a.openPageInfo).toHaveBeenCalled();
  });

  // Ask and Connect are drawn as a modal frame (KnowledgeViewFrame's modal guard): a step inside one not on the modal
  // layer makes the engine step aside, and the card vanished after the first step (PR #2129's browser check).
  it('draws every step inside the Ask or Connect view over it, as the tour’s own dialog', () => {
    for (const id of ['ask', 'connect'] as const) {
      for (const step of allKnowledgeTourSteps(id, editor)) {
        const a = api();
        void step.prepare?.(a);
        const opensView = vi.mocked(a.showView).mock.calls.some(([v]) => v !== 'pages');
        expect(step.layer === 'modal', `${id}/${step.id}`).toBe(opensView);
      }
    }
  });

  it('words the tree for a reader as a reader', () => {
    const viewer = allKnowledgeTourSteps('organise', ROLES.Viewer!).find((s) => s.id === 'tree')!;
    expect(viewer.body).not.toMatch(/Drag/);
    const phone = allKnowledgeTourSteps('organise', ROLES['Phone Editor']!);
    expect(phone.find((s) => s.id === 'search')!.body).not.toMatch(/Cmd/);
  });
});

// Visible to the tour's dom helpers: jsdom lays nothing out, so a drawn element is given a rect.
function drawn(html: string): void {
  document.body.insertAdjacentHTML('beforeend', html);
  for (const el of document.body.querySelectorAll<HTMLElement>('*'))
    el.getClientRects = () => [{ width: 10, height: 10 }] as unknown as DOMRectList;
}

describe('what a run opens', () => {
  it('picks the first selector on screen, else the first', () => {
    drawn('<button data-b></button>');
    expect(pick('[data-a]', '[data-b]')).toBe('[data-b]');
    expect(pick('[data-x]', '[data-y]')).toBe('[data-x]');
  });

  it('unfolds a folded tree and folds it back', () => {
    const expand = vi.fn();
    const collapse = vi.fn();
    drawn(
      '<nav data-page-tree="rail"><button data-page-tree-expand></button><button data-page-tree-collapse></button></nav>',
    );
    document.querySelector('[data-page-tree-expand]')!.addEventListener('click', expand);
    document.querySelector('[data-page-tree-collapse]')!.addEventListener('click', collapse);
    const run = createKnowledgeTourApi();
    run.openTree();
    expect(expand).toHaveBeenCalledOnce();
    run.tidy();
    expect(collapse).toHaveBeenCalledOnce();
    run.tidy();
    expect(collapse).toHaveBeenCalledOnce();
  });

  it('opens a phone’s Pages sheet and closes it as the tour ends', () => {
    const open = vi.fn(() => drawn('<div data-page-tree="sheet"></div>'));
    drawn('<button data-page-tree-button></button>');
    document.querySelector('[data-page-tree-button]')!.addEventListener('click', open);
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    const run = createKnowledgeTourApi();
    run.openTree();
    expect(open).toHaveBeenCalledOnce();
    run.openTree();
    expect(open).toHaveBeenCalledOnce();
    run.tidy();
    expect((keys.mock.calls[0]![0] as KeyboardEvent).key).toBe('Escape');
    window.removeEventListener('keydown', keys);
  });

  it('leaves a tree that was open as it was', () => {
    drawn('<nav data-page-tree="open"></nav><button data-page-tree-collapse></button>');
    const collapse = vi.fn();
    document.querySelector('[data-page-tree-collapse]')!.addEventListener('click', collapse);
    const run = createKnowledgeTourApi();
    run.openTree();
    run.tidy();
    expect(collapse).not.toHaveBeenCalled();
  });

  it('unfolds a docked Page Info rail, or opens its card, and puts each back', () => {
    drawn('<button data-page-rail-expand></button><button data-page-rail-collapse></button>');
    const collapse = vi.fn();
    document.querySelector('[data-page-rail-collapse]')!.addEventListener('click', collapse);
    const docked = createKnowledgeTourApi();
    docked.openPageInfo();
    docked.tidy();
    expect(collapse).toHaveBeenCalledOnce();

    document.body.innerHTML = '';
    drawn('<button data-page-rail-button aria-expanded="false"></button>');
    const button = document.querySelector<HTMLElement>('[data-page-rail-button]')!;
    button.addEventListener('click', () =>
      button.setAttribute(
        'aria-expanded',
        button.getAttribute('aria-expanded') === 'true' ? 'false' : 'true',
      ),
    );
    const card = createKnowledgeTourApi();
    card.openPageInfo();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    card.tidy();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows a view by pressing its tab, unless it is showing', () => {
    drawn('<a data-knowledge-view-link="ask"></a><a data-knowledge-view-link="pages"></a>');
    const ask = vi.fn();
    const pages = vi.fn();
    document.querySelector('[data-knowledge-view-link="ask"]')!.addEventListener('click', ask);
    document.querySelector('[data-knowledge-view-link="pages"]')!.addEventListener('click', pages);
    const run = createKnowledgeTourApi();
    run.showView('pages');
    expect(pages).not.toHaveBeenCalled();
    run.showView('ask');
    expect(ask).toHaveBeenCalledOnce();
  });
});
