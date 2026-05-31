'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { EditorHeader } from '@/components/EditorHeader';
import { Explorer } from '@/components/Explorer';
import { TemplatePicker } from '@/components/TemplatePicker';
import type { Tab } from '@livediagram/diagram';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiCreateDiagram,
  apiCreateFolder,
  apiDeleteDiagram,
  apiDeleteFolder,
  apiDismissSharedWith,
  apiListDiagrams,
  apiListFolders,
  apiListSharedWith,
  apiLoadDiagram,
  apiLoadSelf,
  apiLoadTab,
  apiSaveSelf,
  apiSetDiagramFolder,
  apiUpdateFolder,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { getGuestSelfId, markNameConfirmed, setGuestSelfId } from '@/lib/local-identity';
import { buildTemplatedTab, type TemplateKind } from '@/lib/templates';
import { getTheme, type ThemeId } from '@/lib/themes';

// Dedicated welcome / create-new flow — see specs/14-new-diagram-route.md.
// Owns identity bootstrap, template + theme choice, and the actual
// "commit a new diagram" handoff. Once the user picks (or skips), we
// POST the seeded diagram and navigate to /live/diagram/<id> where
// the editor route picks it up cleanly.
export default function NewDiagramPage() {
  // Stable placeholder so the first paint matches the SSG render — the
  // real participant lands once `useLayoutEffect` runs.
  const [self, setSelf] = useState<Participant>({
    id: 'pending',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  // Two-phase ready:
  //   - `ready` flips as soon as we have a stable local id + name. This
  //     unblocks render so the picker shows even when the API is slow
  //     or offline (a stalled `apiLoadSelf` used to leave this
  //     route stuck on the spinner forever).
  //   - The API roundtrip then runs in the background and replaces the
  //     local stub with the server-side participant if one exists.
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Clerk wiring (token provider + guest→authed migration) — same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  useEffect(() => {
    document.title = 'New diagram | livediagram';
  }, []);

  // Explorer panel state. Lives on this page so the user can hop back
  // into an existing diagram without first having to commit a new one
  // — the welcome flow shouldn't be a dead end. List + loading are
  // sourced from the same API the editor uses, keyed by the local
  // self id once it's available.
  const [diagramList, setDiagramList] = useState<
    { id: string; name: string; folderId: string | null; savedAt: number }[]
  >([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sharedDiagrams, setSharedDiagrams] = useState<SharedWithItem[]>([]);
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  const [explorerPosition, setExplorerPosition] = useState<{ x: number; y: number } | null>(null);
  const [explorerMinimized, setExplorerMinimized] = useState(false);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so a signed-in user gets the Clerk
    // userId, not a freshly-minted guest UUID.
    if (!authLoaded) return;
    let selfId: string;
    if (clerkUserId) {
      selfId = clerkUserId;
    } else {
      const stored = getGuestSelfId();
      if (stored) {
        selfId = stored;
      } else {
        selfId = crypto.randomUUID();
        setGuestSelfId(selfId);
      }
    }
    const local: Participant = {
      id: selfId,
      name: randomName(),
      color: randomColor(),
      status: 'online',
    };
    setSelf(local);
    setReady(true);

    // Safety net mirrors the editor route: hung API leaves the
    // Explorer skeleton up otherwise. 10s feels right — long enough
    // for a real fetch to complete, short enough that a dead network
    // surfaces an empty list rather than an indefinite spinner.
    const safety = window.setTimeout(() => setDiagramListLoading(false), 10000);
    void (async () => {
      const stored = await apiLoadSelf(selfId).catch(() => null);
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await apiSaveSelf(local).catch(() => {});
      }
      const [list, foldersList, sharedList] = await Promise.all([
        apiListDiagrams(selfId).catch(() => null),
        apiListFolders(selfId).catch(() => null),
        apiListSharedWith(selfId).catch(() => null),
      ]);
      window.clearTimeout(safety);
      setDiagramList(list ?? []);
      setFolders(foldersList ?? []);
      setSharedDiagrams(sharedList ?? []);
      setDiagramListLoading(false);
    })();

    return () => window.clearTimeout(safety);
  }, [authLoaded, clerkUserId]);

  // Single commit point — shared by the Submit (Create Diagram) and
  // Skip / X paths. Submit passes a template + theme; Skip passes
  // null + 'brand' for a fresh empty starter tab. Either way we
  // persist the diagram so the editor route lands on a real row.
  const commitNewDiagram = async (
    templateKind: TemplateKind | null,
    name: string,
    themeId: ThemeId,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    // Identity persistence first so any subsequent room broadcasts
    // carry the chosen name + colour.
    const trimmed = name.trim() || self.name;
    if (trimmed !== self.name) {
      const updated: Participant = { ...self, name: trimmed };
      setSelf(updated);
      await apiSaveSelf(updated).catch(() => {});
    }
    markNameConfirmed();

    const diagramId = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    const tab = templateKind
      ? buildTemplatedTab(templateKind, themeId, tabId, 'Tab 1')
      : {
          // Skipped — fall through to a blank canvas with the chosen
          // theme's backdrop so the editor loads in the user's style
          // without any seeded elements.
          id: tabId,
          name: 'Tab 1',
          elements: [],
          theme: themeId,
          backgroundColor: getTheme(themeId).backgroundColor,
          backgroundPattern: getTheme(themeId).backgroundPattern,
          patternColor: getTheme(themeId).patternColor,
          templateChosen: true,
        };
    await apiCreateDiagram(self.id, {
      id: diagramId,
      name: 'Untitled diagram',
      tabs: [tab],
    }).catch(() => {
      // Network glitch — the editor route's autosave will retry on
      // the first edit. Navigation continues either way.
    });
    window.location.assign(`/live/diagram/${diagramId}`);
  };

  const openDiagram = (id: string) => {
    window.location.assign(`/live/diagram/${id}`);
  };

  const refreshList = async (ownerId: string) => {
    const [list, foldersList] = await Promise.all([
      apiListDiagrams(ownerId).catch(() => null),
      apiListFolders(ownerId).catch(() => null),
    ]);
    setDiagramList(list ?? []);
    setFolders(foldersList ?? []);
  };

  const createFolder = async (input: { name: string; parentId: string | null }) => {
    const id = crypto.randomUUID();
    try {
      const folder = await apiCreateFolder(self.id, {
        id,
        name: input.name,
        parentId: input.parentId,
      });
      setFolders((prev) => [...prev, folder]);
      return folder;
    } catch {
      return undefined;
    }
  };

  const renameFolder = (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    void apiUpdateFolder(self.id, id, { name }).catch(() => {});
  };

  const deleteFolder = (id: string) => {
    setFolders((prev) =>
      prev
        .filter((f) => f.id !== id)
        .map((f) => (f.parentId === id ? { ...f, parentId: null } : f)),
    );
    setDiagramList((prev) => prev.map((d) => (d.folderId === id ? { ...d, folderId: null } : d)));
    void apiDeleteFolder(self.id, id).catch(() => {});
  };

  const moveDiagramToFolder = (diagramId: string, folderId: string | null) => {
    setDiagramList((prev) => prev.map((d) => (d.id === diagramId ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(self.id, diagramId, folderId).catch(() => {});
  };

  const deleteDiagram = (id: string) => {
    void apiDeleteDiagram(self.id, id).catch(() => {});
    setDiagramList((prev) => prev.filter((d) => d.id !== id));
    void refreshList(self.id);
  };

  // Duplicate logic mirrors the editor route's `duplicateDiagram`:
  // load the source + every tab, mint new tab ids, rewrite tab-link
  // references through the id remap so cross-tab navigation survives
  // the copy. Kept here (rather than in a shared helper) because the
  // welcome route can hit a different participant id than the editor
  // route during the brief identity-bootstrap window.
  const duplicateDiagram = async (id: string) => {
    const src = await apiLoadDiagram(self.id, id).catch(() => null);
    if (!src) return;
    const fullTabs = await Promise.all(
      src.tabs.map((t) => apiLoadTab(self.id, src.id, t.id).catch(() => null)),
    );
    const tabIdMap = new Map<string, string>();
    for (const t of src.tabs) tabIdMap.set(t.id, crypto.randomUUID());
    const remappedTabs: Tab[] = [];
    for (const tab of fullTabs) {
      if (!tab) continue;
      const newTabId = tabIdMap.get(tab.id) ?? crypto.randomUUID();
      const elements = tab.elements.map((el) => {
        if ('link' in el && el.link) {
          const next = tabIdMap.get(el.link.tabId);
          if (next) return { ...el, link: { ...el.link, tabId: next } };
        }
        return el;
      });
      remappedTabs.push({ ...tab, id: newTabId, elements });
    }
    const newId = crypto.randomUUID();
    await apiCreateDiagram(self.id, {
      id: newId,
      name: `${src.name} copy`,
      tabs: remappedTabs,
    }).catch(() => {});
    await refreshList(self.id);
  };

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader
        diagramName="New diagram"
        hideTitle
        showShare={false}
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
      />
      {/* TemplatePicker positions itself absolute over its parent;
          the relative wrapper gives it a stage. Below it the
          backdrop reads as an empty canvas — same idle look as the
          editor route under the welcome modal it used to render
          inline. */}
      <main className="relative flex-1 bg-slate-50">
        {ready ? (
          <TemplatePicker
            mode="welcome"
            participant={self}
            currentThemeId="brand"
            onPick={(kind, name, themeId) => void commitNewDiagram(kind, name, themeId)}
            onSkip={() => void commitNewDiagram(null, self.name, 'brand')}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="animate-spin text-brand-500"
              aria-hidden
            >
              <circle cx="16" cy="16" r="12" strokeOpacity="0.18" />
              <path d="M28 16a12 12 0 0 0-12-12" />
            </svg>
          </div>
        )}
        {/* Explorer is the one piece of chrome that stays visible on
            the welcome route — clicking an existing diagram is the
            primary escape hatch from "I came here by accident". The
            New Diagram CTA is suppressed here because the user is
            already in the new-diagram flow. */}
        <Explorer
          position={explorerPosition}
          minimized={explorerMinimized}
          diagrams={diagramList}
          folders={folders}
          loading={diagramListLoading}
          shared={sharedDiagrams}
          onDismissShared={(diagramId) => {
            setSharedDiagrams((prev) => prev.filter((d) => d.id !== diagramId));
            void apiDismissSharedWith(self.id, diagramId).catch(() => {});
          }}
          currentDiagramId={null}
          onMoveTo={(x, y) => setExplorerPosition({ x, y })}
          onToggleMinimized={() => setExplorerMinimized((v) => !v)}
          onReset={() => setExplorerPosition(null)}
          onOpenDiagram={openDiagram}
          onDeleteDiagram={deleteDiagram}
          onDuplicateDiagram={(id) => void duplicateDiagram(id)}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveDiagramToFolder={moveDiagramToFolder}
        />
      </main>
    </div>
  );
}
