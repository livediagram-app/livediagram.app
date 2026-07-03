'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { ApiErrorPage } from '@/components/chrome/ApiErrorPage';
import { TemplatePicker } from '@/components/palette/TemplatePicker';
import { RecentDiagramsCard } from './RecentDiagramsCard';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { apiCreateDiagram, apiLoadSelf, apiSaveSelf, apiSetDiagramFolder } from '@/lib/api-client';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { ensureGuestSelfId, markNameConfirmed } from '@/lib/local-identity';
import { buildTemplatedTab } from '@/lib/template-builders';
import { untitledNameForTemplate, type TemplateKind } from '@livediagram/templates';
import { getTheme, THEMES } from '@/lib/themes';
import { isCustomThemeId } from '@/lib/custom-theme-registry';

// Dedicated welcome / create-new flow, see specs/14-new-diagram-route.md.
// Owns identity bootstrap, template + theme choice (a two-step wizard),
// and the actual "commit a new diagram" handoff. Once the user picks (or
// skips), we POST the seeded diagram and navigate to /diagram/<id> where
// the editor route picks it up cleanly. The Explorer is NOT rendered here:
// the wizard's "Open Existing Diagram" button sends users to /explorer
// instead, keeping this screen focused on creating.
export default function NewDiagramPage() {
  // Stable placeholder so the first paint matches the SSG render; the
  // real participant lands once `useLayoutEffect` runs.
  const [self, setSelf] = useState<Participant>({
    id: 'pending',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  const [submitting, setSubmitting] = useState(false);
  // Set when the create POST fails (network / 5xx). Shows a retryable
  // error instead of navigating to the editor for a diagram that was
  // never persisted (which would 404). The ref keeps the last attempt's
  // args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState(false);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    name: string;
    // string, not ThemeId: the picker can hand back a custom `custom:<uuid>`
    // theme id (spec/44) as well as a built-in one.
    themeId: string;
  } | null>(null);

  // Clerk wiring (token provider + guest to authed migration), the same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  useEffect(() => {
    document.title = 'New diagram | livediagram';
  }, []);

  // Back/forward-cache restore: creating navigates away with
  // `submitting === true` still set, and the browser Back button
  // restores this page from bfcache exactly as frozen — leaving the
  // Create button stuck on "Creating…" forever. `pageshow` with
  // `persisted` is the restore signal; reset the transient submit
  // state so the page is usable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so a signed-in user gets the Clerk
    // userId, not a freshly-minted guest UUID.
    if (!authLoaded) return;
    // Daily-active-returns signal (spec/22): once-per-browser-per-UTC-day,
    // gated inside the helper. Auth has settled, so guest vs signed-in is known.
    trackDailyReturn(!!clerkUserId);
    const selfId = clerkUserId ?? ensureGuestSelfId();
    const local: Participant = {
      id: selfId,
      name: randomName(),
      color: randomColor(),
      status: 'online',
    };
    setSelf(local);

    void (async () => {
      const stored = await apiLoadSelf(selfId).catch(() => null);
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await apiSaveSelf(local).catch(() => {});
      }
    })();
  }, [authLoaded, clerkUserId]);

  // Single commit point, shared by the Create Diagram and Skip paths.
  // Submit passes a template + theme; Skip passes 'blank' + 'brand'. Either
  // way we persist the diagram so the editor route lands on a real row.
  const commitNewDiagram = async (
    templateKind: TemplateKind | null,
    name: string,
    themeId: string,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    lastCreateArgs.current = { kind: templateKind, name, themeId };
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
          // Skipped: fall through to a blank canvas with the chosen
          // theme's backdrop so the editor loads in the user's style
          // without any seeded elements.
          id: tabId,
          name: 'Tab 1',
          elements: [],
          theme: themeId,
          backgroundColor: getTheme(themeId).backgroundColor,
          backgroundPattern: getTheme(themeId).backgroundPattern,
          patternColor: getTheme(themeId).patternColor,
          ...(getTheme(themeId).backgroundOpacity != null
            ? { backgroundOpacity: getTheme(themeId).backgroundOpacity }
            : {}),
          templateChosen: true,
        };
    try {
      await apiCreateDiagram(self.id, {
        id: diagramId,
        name: untitledNameForTemplate(templateKind),
        tabs: [tab],
      });
    } catch {
      // Create FAILED (network down / 5xx). Don't navigate to the editor
      // for a diagram that was never persisted (that lands on a 404).
      // Surface a retryable error card instead (Retry re-runs this exact
      // create from lastCreateArgs).
      setSubmitting(false);
      setCreateError(true);
      return;
    }
    // Anonymous telemetry (spec/22): a diagram was created. No id or
    // name is sent, just the event. The chosen theme is recorded
    // alongside since the picker on this screen is the first place a
    // theme gets set; later switches in the editor emit the same way.
    track('Diagram', 'Created');
    // Telemetry `type` must stay a preset, never user content, so a custom
    // theme reports the fixed 'Custom' rather than its name (spec/22, /44).
    const themeLabel = isCustomThemeId(themeId)
      ? 'Custom'
      : (THEMES.find((t) => t.id === themeId)?.label ??
        themeId.charAt(0).toUpperCase() + themeId.slice(1));
    track('Theme', 'Changed', themeLabel);
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    // Placement context from the URL. /new?folder=<id> drops a fresh
    // diagram straight into the folder the user was browsing;
    // /new?team=<id>(&folder=<id>) sends it into that team's shared
    // library (spec/35), scoped to the open team folder when one is set.
    // Done as a follow-up PUT so the create endpoint signature stays
    // stable and placement can fail independently (network glitch ->
    // diagram lives in the personal Unsorted, user can move it later).
    const params = new URLSearchParams(window.location.search);
    const targetFolderId = params.get('folder');
    const targetTeamId = params.get('team');
    if (targetTeamId) {
      await apiSetDiagramFolder(self.id, diagramId, targetFolderId, targetTeamId).catch(() => {});
    } else if (targetFolderId) {
      await apiSetDiagramFolder(self.id, diagramId, targetFolderId).catch(() => {});
    }
    window.location.assign(`/diagram/${diagramId}`);
  };

  if (createError) {
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
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <ApiErrorPage
            title="Couldn’t create the diagram"
            message="We couldn’t reach the server to create your diagram. Check your connection and try again."
            onRetry={() => {
              setCreateError(false);
              const a = lastCreateArgs.current;
              if (a) void commitNewDiagram(a.kind, a.name, a.themeId);
            }}
          />
        </main>
      </div>
    );
  }

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
      <main className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Soft animated lines give the otherwise-empty backdrop life
            behind the wizard card. Decorative + reduced-motion aware. */}
        <AnimatedLinesBackdrop />
        {/* No identity spinner: the wizard's first step is static template
            data, so it renders immediately. Identity resolves in the
            background; the picker follows the resolved participant name on
            its own (it no longer remounts on id change, which used to flash
            the card once the real id landed). Mounting CustomThemeProvider
            with a null owner until then just defers the Custom theme list
            (spec/44). */}
        <CustomThemeProvider ownerId={self.id === 'pending' ? null : self.id}>
          <TemplatePicker
            mode="welcome"
            participant={self}
            currentThemeId="brand"
            busy={submitting}
            onOpenExisting={() => window.location.assign('/explorer/recent')}
            onPick={(kind, name, themeId) => void commitNewDiagram(kind, name, themeId)}
            onSkip={() => void commitNewDiagram('blank', self.name, 'brand')}
          />
        </CustomThemeProvider>
        {/* Returning users get a "jump back in" shortcut beside the wizard
            (spec/14). Hidden when there are no diagrams yet / on narrow
            viewports. */}
        <RecentDiagramsCard ownerId={self.id === 'pending' ? null : self.id} />
      </main>
    </div>
  );
}
