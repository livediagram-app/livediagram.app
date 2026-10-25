import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/003-system-architecture/react-state-and-effects.md "Rendering in the browser only": render never guards a
// browser global with `typeof window`, and no `useHydrated`-style state stands in for `use(browser())`. A guard
// that stays is outside render, and is listed here with where it runs (the blueprint's "Stay as they are").

const repo = fileURLToPath(new URL('../../', import.meta.url));
const OUTSIDE_RENDER: Record<string, string> = {
  'apps/editor/components/primitives/MovablePanel.tsx':
    'clampFree, called from handlers and an effect',
  'apps/editor/components/drive/DriveMirrorProvider.tsx':
    'connectOutcomeOnce, module state read once in an effect',
  'apps/editor/components/primitives/PagedCarousel.tsx':
    'prefersReducedMotion, called from a scroll handler',
  'apps/editor/components/canvas/ReactionBurst.tsx': 'inside the drawing effect',
  'apps/editor/components/canvas/arrow-flow.tsx': 'inside the pinning effect',
  // Hooks: read in effects, handlers, store snapshots and subscriptions, or module state the browser-only Explorer reads.
  '../packages/ui/src/useClickOutside.ts': 'inside an effect',
  '../packages/ui/src/useEscape.ts': 'inside an effect',
  '../packages/ui/src/useFocusTrap.ts': 'coarsePointer, called from the open effect',
  '../packages/ui/src/useMediaQuery.ts': 'subscribe and snapshot of an external store',
  '../packages/ui/src/useVisualViewportBand.ts': 'subscribe and snapshot of an external store',
  'apps/editor/app/document/[id]/useTabEntryEffects.ts': 'inside an effect',
  'apps/editor/app/document/[id]/useCollabDeepLink.ts': 'inside an effect',
  'apps/editor/hooks/ui/usePanelDock.ts': 'inside an effect',
  'apps/editor/hooks/canvas/useDocumentActions.ts': 'inside a handler',
  'apps/editor/hooks/canvas/useAutoCopyParam.ts': 'inside an effect',
  'apps/editor/hooks/canvas/useClipboard.ts': 'inside a handler',
  'apps/editor/hooks/collab/useFacilitator.ts': 'readToken and writeToken, called from callbacks',
  'apps/editor/components/primitives/useMovablePanelMeasure.ts': 'inside an effect',
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      ['node_modules', 'out', 'dist', 'e2e', 'test-results'].includes(name) ||
      name.startsWith('.')
    )
      continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/(\.tsx|^use[A-Z][A-Za-z]*\.ts)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(path);
  }
  return out;
}

// The shared design system (@liveworkspace/ui) renders here too, so its hooks are held to the rule as well.
// So is the editor code every editor shares (@liveworkspace/workbench).
const files = ['apps', 'packages', '../packages/ui/src', '../packages/workbench/src'].flatMap((d) =>
  sources(`${repo}${d}`),
);
const rel = (path: string) => path.slice(repo.length);

describe('browser globals in components', () => {
  it('are never guarded with typeof window outside the listed effects and handlers', () => {
    const guarded = files
      .filter((f) => /typeof window\s*[!=]==/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .filter((f) => !(f in OUTSIDE_RENDER));
    expect(guarded).toEqual([]);
  });

  it('list only files that still guard', () => {
    const stale = Object.keys(OUTSIDE_RENDER).filter(
      (f) => !/typeof window\s*[!=]==/.test(readFileSync(`${repo}${f}`, 'utf8')),
    );
    expect(stale).toEqual([]);
  });

  it('are never stood in for by a hydration flag', () => {
    const flagged = files.filter((f) => /\buseHydrated\b/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(flagged).toEqual([]);
  });
});
