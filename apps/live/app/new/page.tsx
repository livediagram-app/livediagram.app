'use client';

import { useLayoutEffect, useState } from 'react';
import { EditorHeader } from '@/components/EditorHeader';
import { Explorer } from '@/components/Explorer';
import { TemplatePicker } from '@/components/TemplatePicker';
import {
  apiCreateDiagram,
  listDiagrams,
  loadSelfParticipant,
  saveSelfParticipant,
} from '@/lib/diagram-store';
import { randomColor, randomName, type Participant } from '@/lib/identity';
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
  //     or offline (a stalled `loadSelfParticipant` used to leave this
  //     route stuck on the spinner forever).
  //   - The API roundtrip then runs in the background and replaces the
  //     local stub with the server-side participant if one exists.
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Explorer panel state. Lives on this page so the user can hop back
  // into an existing diagram without first having to commit a new one
  // — the welcome flow shouldn't be a dead end. List + loading are
  // sourced from the same API the editor uses, keyed by the local
  // self id once it's available.
  const [diagramList, setDiagramList] = useState<{ id: string; name: string; savedAt: number }[]>(
    [],
  );
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  const [explorerPosition, setExplorerPosition] = useState<{ x: number; y: number } | null>(null);
  const [explorerMinimized, setExplorerMinimized] = useState(false);

  useLayoutEffect(() => {
    let selfId = window.localStorage.getItem('livediagram:v2:self-id');
    if (!selfId) {
      selfId = crypto.randomUUID();
      window.localStorage.setItem('livediagram:v2:self-id', selfId);
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
      const stored = await loadSelfParticipant(selfId).catch(() => null);
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await saveSelfParticipant(local).catch(() => {});
      }
      const list = await listDiagrams(selfId).catch(() => null);
      window.clearTimeout(safety);
      setDiagramList(list ?? []);
      setDiagramListLoading(false);
    })();

    return () => window.clearTimeout(safety);
  }, []);

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
      await saveSelfParticipant(updated).catch(() => {});
    }
    window.localStorage.setItem('livediagram:v2:name-confirmed', '1');

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

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader
        diagramName="New diagram"
        hideTitle
        showShare={false}
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
        onDeleteDiagram={() => {}}
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
          loading={diagramListLoading}
          currentDiagramId={null}
          onMoveTo={(x, y) => setExplorerPosition({ x, y })}
          onToggleMinimized={() => setExplorerMinimized((v) => !v)}
          onReset={() => setExplorerPosition(null)}
          onOpenDiagram={openDiagram}
        />
      </main>
    </div>
  );
}
