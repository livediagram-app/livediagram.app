'use client';

// A Form tab's page (docs/specs/030-forms/forms.md "Building a form"): drawn over the canvas area, as a Dashboard
// is (CanvasCover). An Editor builds the form in place, every setting inside it: a question's in its card, Responses
// Go To and Settings under the status bar's cog. Preview (and everyone who may not edit) sees it exactly as the form
// link draws it. The status bar holds the help link and the cog; the menu box, its name; the corner's Share is Share
// Form, with Preview to its left (lib/form-share-store.ts).
import { useNow } from '@liveworkspace/workbench/hooks/ui/useNow';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { formLook, type Tab } from '@liveplanner/project';
import { ITEMS_MAX } from '@liveplanner/items';
import {
  FORM_WIDTH_PX,
  closedBySettings,
  destinationType,
  publicForm,
  publishProblemText,
  publishProblems,
  readForm,
  type FormDefinition,
  type PublishProblem,
} from '@liveplanner/forms';
import { apiImageUrl, releaseImageUrl } from '@/lib/api/images';
import { track } from '@/lib/telemetry';
import { FormImageContext, type FormImageReader } from './form-images';
import { CanvasCover } from '@/components/plan/MaximisedPlanLayer';
import { DashboardMenuName } from '@/components/plan/dashboard/DashboardMenuName';
import { setFormShareHost } from '@/lib/form-share-store';
import { setFormProblemsHost } from '@/lib/form-problems-store';
import { usePlan } from '@/components/plan/PlanContext';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { sendPreview } from '@/hooks/forms/form-preview';
import { apiSendFormPreview } from '@/lib/api/forms';
import { FormBuilderContext, type FormBuilderValue } from './builder/form-builder-context';
import { FormBuilderColumn } from './builder/FormBuilderColumn';
import { formProblemCount } from './FormProblems';
import { FormLockedStrip } from './FormLockedStrip';
import { FormSettingsButton, type FormSettingsSection } from './builder/FormSettingsButton';
import { FormStatusBar } from './FormStatusBar';
import { ShareFormDialog } from './ShareFormDialog';
import { FormFill } from './respond/FormFill';
import { formLookProps } from './form-look';
<<<<<<< HEAD
import { formDestinationOf, planBoardsOf } from './form-destination';
=======
import { formDestinationOf } from './form-destination';
import { summaryOffered } from './summary/form-responses';
>>>>>>> origin/main
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

// The Summary (docs/specs/030-forms/forms.md "The Summary"), fetched only when it is opened.
const FormSummary = dynamic(() => import('./summary/FormSummary').then((m) => m.FormSummary), {
  ssr: false,
});

// How often an open form with a Close On reads the clock, to turn Closed when it passes.
const NOW_TICK_MS = 60_000;

export function FormPage({
  tab,
  tabs,
  canEdit,
  actions,
  openTab,
  loadTabs,
  projectId,
  ownerId,
  share,
  online,
  onSyncToCloud,
  syncReady,
  tabScope = null,
}: {
  tab: Tab;
  tabs: readonly Tab[];
  canEdit: boolean;
  actions: FormActions;
  openTab: (tabId: string) => void;
  loadTabs?: (only?: readonly string[]) => Promise<string[]>;
  projectId: string | null;
  ownerId: string;
  share: string | null;
  // A project kept on the server (an offline one has no link to publish).
  online: boolean;
  // Moves an offline project onto the server in place, from Share Form, once the reader is known.
  onSyncToCloud?: () => Promise<void>;
  syncReady?: boolean;
  // The one tab a tab-scoped share session reaches (docs/specs/013-workspace/tab-scoped-share-links.md); null for
  // everyone else.
  tabScope?: string | null;
}) {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  const layout = useCanvasLayerInsets(canvas, false);
  const plan = usePlan();
  const types = useMemo(() => plan?.types ?? [], [plan?.types]);
  const form: FormDefinition = useMemo(
    () =>
      readForm(tab.form) ?? {
        v: 1,
        heading: tab.name,
        sections: [{ id: 's-1', title: '', questions: [] }],
      },
    [tab.form, tab.name],
  );
  // The look respondents see: the tab's theme (its colour too), finish and font.
  const { theme, finish, font } = tab;
  const look = useMemo(
    () => formLookProps(formLook({ theme, finish, font })),
    [theme, finish, font],
  );
  const [preview, setPreview] = useState(false);
  // The Summary, in place of the form.
  const [summary, setSummary] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // The cog's panel: the section it opened on (null, both closed), or false while shut.
  const [settings, setSettings] = useState<FormSettingsSection | null | false>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The board tabs' content, so Responses Go To can read every board's columns and the types it takes.
  const boardTabIds = tabs
    .filter((t) => t.kind === 'board')
    .map((t) => t.id)
    .join(',');
  useEffect(() => {
    if (boardTabIds) void loadTabs?.(boardTabIds.split(','));
  }, [boardTabIds, loadTabs]);

  const link = useFormLink({
    projectId,
    tabId: tab.id,
    ownerId,
    share,
    enabled: online && !!projectId,
  });
  // Switched on, but past its Close On or at its Response Limit: closed to respondents, so it reads Closed and is
  // not locked (docs/specs/030-forms/forms.md "Hearing about responses").
  // The clock, read once a minute while an open form has a Close On to pass.
  const now = useNow(!!form.closesAt && !!link.link?.link?.open, NOW_TICK_MS);
  const closedBy = closedBySettings(form, { responses: link.link?.responses ?? 0, now });
  const overdue = !!closedBy;
  // A form taking responses is locked (docs/specs/030-forms/forms.md "A live form is locked"): Edit Form stops it first.
  const locked = canEdit && !!link.link?.link?.open && !overdue;
  const building = canEdit && !preview && !locked;
  // Where responses go: a Sheet (a row each) when the form names one, else its board.
  const { destTab, problem, warning } = formDestinationOf(form, tabs, types, tabScope);
  const warnings = useMemo(() => (warning ? [warning] : []), [warning]);
  const type = destinationType(form.destination, types);
  // What else stops publishing (docs/specs/030-forms/forms.md "Publishing and the form link").
  // Every board of the plan, for the card type rules (forms.md "Choosing the card type by an answer").
  // A form without rules reads no board for them.
  const ruled = !form.sheet && !!form.destination?.typeRules;
  const place = useMemo(
    () => ({ types, boards: ruled ? planBoardsOf(tabs).map((x) => x.setup) : [] }),
    [types, tabs, ruled],
  );
  const notReady = useMemo(
    () => publishProblems(form, form.sheet ? undefined : type, place),
    [form, type, place],
  );

  // Each question's own problems, for the mark on its card.
  const questionProblems = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const p of notReady)
      if ('questionId' in p && p.questionId)
        by.set(p.questionId, [...(by.get(p.questionId) ?? []), publishProblemText(p)]);
    return by;
  }, [notReady]);
  // Responses Go To or Settings, from wherever a fix is offered (out of Preview first).
  const openSettings = useCallback((section: FormSettingsSection | null) => {
    setPreview(false);
    setSummary(false);
    setSettings(section);
  }, []);
  const select = useCallback((id: string | null, focus = false) => {
    setSelectedId(id);
    if (focus) setFocusId(id);
  }, []);
  // The form's pictures: the plan's, read as this person (and their link).
  const images = useMemo(
    () => (online && projectId ? { ownerId, projectId, shareCode: share } : null),
    [online, projectId, ownerId, share],
  );
  const imageReader = useMemo<FormImageReader | null>(
    () => (images ? { src: (id) => apiImageUrl(images, id), release: releaseImageUrl } : null),
    [images],
  );
  const togglePreview = useCallback(() => {
    setSummary(false);
    setPreview((p) => !p);
  }, []);
  const toggleSummary = useCallback(() => {
    setPreview(false);
    setSelectedId(null);
    if (!summary) track('Form', 'Opened', 'Summary');
    setSummary(!summary);
  }, [summary]);
  // Offered to whoever reaches the tab the responses are on (summaryOffered).
  const canSummarise = summaryOffered(destTab, tabScope);
  const summarising = summary && canSummarise;
  // Preview, the Summary and back start at the form's top.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [preview, summarising]);
  // Escape leaves Preview, and the Summary.
  useEffect(() => {
    if (!preview && !summarising) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPreview(false);
      setSummary(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [preview, summarising]);

  const value = useMemo<FormBuilderValue>(
    () => ({
      form,
      canEdit: building,
      actions,
      selectedId,
      select,
      focusId,
      clearFocus: () => setFocusId(null),
      type,
      types,
      openSettings,
      locked,
      problemCount: formProblemCount(problem, notReady),
      questionProblems,
      images,
    }),
    [
      images,
      form,
      building,
      actions,
      selectedId,
      select,
      focusId,
      type,
      types,
      openSettings,
      locked,
      problem,
      notReady,
      questionProblems,
    ],
  );
  // The header's Share is this form's while an Editor has it open (lib/form-share-store.ts).
  const published = !!link.link?.link;
  useEffect(() => {
    if (!canEdit) return;
    setFormShareHost({ published, open: () => setShareOpen(true), preview, togglePreview });
    return () => setFormShareHost(null);
  }, [canEdit, published, preview, togglePreview]);
  // Show a problem's question or section, out of Preview first.
  const showProblem = useCallback(
    (p: PublishProblem) => {
      setPreview(false);
      setSummary(false);
      if ('questionId' in p && p.questionId) select(p.questionId, true);
      else if (p.kind === 'broken_rule')
        document
          .querySelector(`[data-form-section-id="${p.sectionId}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    [select],
  );
  // The bottom-right cluster's Problems, an Editor's (lib/form-problems-store.ts).
  useEffect(() => {
    if (!canEdit) return;
    setFormProblemsHost({
      problem,
      notReady,
      warnings,
      onFixDestination: () => openSettings('destination'),
      onShow: showProblem,
    });
    return () => setFormProblemsHost(null);
  }, [canEdit, problem, notReady, warnings, openSettings, showProblem]);
  const phone = useIsMobileViewport();
  const shown = publicForm(form);
  const maxWidth = FORM_WIDTH_PX[form.width ?? 'narrow'];

  return (
    <>
      <span hidden ref={mark} />
      <DashboardMenuName
        tab={tab}
        kindLabel="Form"
        onRename={canEdit && !locked ? (name) => actions.renameForm(name) : undefined}
      />
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-form-page': '' }} enter>
              <FormImageContext.Provider value={imageReader}>
                <FormBuilderContext.Provider value={value}>
                  <div
                    role="region"
                    aria-label={`${form.heading} form`}
                    className="flex h-full min-h-0 px-3 pt-3 max-sm:px-2"
                  >
                    <div
                      ref={scrollRef}
                      className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain pb-24 [scrollbar-gutter:stable_both-edges] max-sm:pb-[calc(6rem+env(safe-area-inset-bottom))]"
                    >
                      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth }}>
                        <FormStatusBar
                          link={link}
                          problem={problem}
                          closedBy={closedBy}
                          // Only cards fill a project: a sheet's rows never do.
                          full={!form.sheet && (plan?.items.size ?? 0) >= ITEMS_MAX}
                          canEdit={canEdit}
                          onFix={() => openSettings('destination')}
                          onOpenResponses={destTab ? () => openTab(destTab.id) : null}
                          destinationName={destTab?.name ?? null}
                          // In the top row where a palette sits, on a desktop; heading the column on a phone.
                          top={phone ? null : canvas}
                          summary={canSummarise ? { on: summarising, toggle: toggleSummary } : null}
                          onNotTaking={(fix) => {
                            if (fix === 'share') setShareOpen(true);
                            else if (fix === 'responses') {
                              if (destTab) openTab(destTab.id);
                            } else openSettings(fix);
                          }}
                          controls={
                            canEdit ? (
                              // Preview sits left of Share Form (lib/form-share-store.ts). The cog stays an
                              // Editor's while the form is locked: its Settings (closing it, its messages) still apply;
                              // Responses Go To is locked with the form.
                              !preview ? (
                                <FormSettingsButton
                                  tabs={tabs}
                                  link={link}
                                  open={settings}
                                  onOpen={setSettings}
                                  onClose={() => setSettings(false)}
                                />
                              ) : null
                            ) : null
                          }
                        />
                        {locked && !preview ? (
                          <FormLockedStrip
                            onEdit={() => void link.setOpen(false)}
                            busy={link.busy}
                          />
                        ) : null}
                        {!canEdit ? (
                          <p className="rounded-xl bg-white/80 px-4 py-2.5 text-[13px] text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                            This is a form. Its responses become{' '}
                            {form.sheet ? 'rows in' : 'cards on'}{' '}
                            <strong>{destTab?.name ?? (form.sheet ? 'a sheet' : 'a board')}</strong>
                            .
                          </p>
                        ) : null}
                      </div>
                      {summarising && destTab ? (
                        <div className="mx-auto mt-3 w-full" style={{ maxWidth }}>
                          <FormSummary
                            form={form}
                            tabId={tab.id}
                            destinationName={destTab.name}
                            onOpenResponses={() => openTab(destTab.id)}
                            onShare={canEdit ? () => setShareOpen(true) : undefined}
                          />
                        </div>
                      ) : null}
                      {/* The look dresses the form alone: the status bar and the panel are the editor's. */}
                      <div className="mt-3" hidden={summarising} {...look}>
                        {/* An Editor's form is the builder, read-only while it is locked. */}
                        {canEdit && !preview ? (
                          <FormBuilderColumn
                            scrollRef={scrollRef}
                            hasDestinations={tabs.some(
                              (t) => t.kind === 'board' || t.kind === 'sheet',
                            )}
                            problem={problem}
                          />
                        ) : (
                          <div className="mx-auto w-full" style={{ maxWidth }}>
                            <FormFill
                              key={preview ? 'preview' : 'view'}
                              form={shown}
                              draftKey={null}
                              preview
                              {...(canEdit
                                ? {
                                    previewNote: `This was a preview: its ${form.sheet ? 'row' : 'card'}, marked Preview, is on ${destTab?.name ?? (form.sheet ? 'the sheet' : 'the board')}.`,
                                    submit: async (state) => {
                                      const outcome = await sendPreview({
                                        form,
                                        tabId: tab.id,
                                        type,
                                        problem,
                                        addItems: plan?.addItems,
                                        state,
                                        offline: !online,
                                        place,
                                        // A published form counts it as a response; a Sheet's row is
                                        // always written by the api.
                                        sendToLink:
                                          (published || !!form.sheet) && projectId
                                            ? (s) =>
                                                apiSendFormPreview(
                                                  ownerId,
                                                  projectId,
                                                  tab.id,
                                                  s,
                                                  share,
                                                )
                                            : undefined,
                                      });
                                      if (outcome.kind === 'sent') link.reload();
                                      return outcome;
                                    },
                                  }
                                : { submit: async () => ({ kind: 'sent' }) })}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </FormBuilderContext.Provider>
              </FormImageContext.Provider>
            </CanvasCover>,
            canvas,
          )
        : null}
      <ShareFormDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        link={link}
        problem={problem}
        onFixDestination={() => {
          setShareOpen(false);
          openSettings('destination');
        }}
        notReady={notReady}
        warnings={warnings}
        toSheet={!!form.sheet}
        onSyncToCloud={onSyncToCloud}
        syncReady={syncReady}
        form={shown}
        onShow={(p) => {
          setShareOpen(false);
          showProblem(p);
        }}
      />
    </>
  );
}
