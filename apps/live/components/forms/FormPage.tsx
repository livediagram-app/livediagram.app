'use client';

// A Form tab's page (docs/specs/030-forms/forms.md "Building a form"): drawn over the canvas area, as a Dashboard
// is (CanvasCover). An Editor builds the form in place, every setting inside it: a question's in its card, Responses
// Go To and Settings under the status bar's cog. Preview (and everyone who may not edit) sees it exactly as the form
// link draws it. The status bar holds Preview, the help link and the cog; the menu box, its name; the header's Share is
// Share Form (lib/form-share-store.ts).
import { useNow } from '@/hooks/ui/useNow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formLook, type Tab } from '@livediagram/document';
import { ITEMS_MAX } from '@livediagram/items';
import {
  closedBySettings,
  destinationProblem,
  destinationType,
  publicForm,
  publishProblems,
  sheetDestinationProblem,
  readForm,
  type FormDefinition,
} from '@livediagram/forms';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { lucideEye } from '@livediagram/icons/lucide';
import { CanvasCover } from '@/components/plan/MaximisedPlanLayer';
import { DashboardMenuName } from '@/components/plan/dashboard/DashboardMenuName';
import { setFormShareHost } from '@/lib/form-share-store';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { usePlan } from '@/components/plan/PlanContext';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { boardsOf, sheetsOf } from '@livediagram/templates';
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

const EyeIcon = lucideGlyph(lucideEye, 16);

// How often an open form with a Close On reads the clock, to turn Closed when it passes.
const NOW_TICK_MS = 60_000;

export function FormPage({
  tab,
  tabs,
  canEdit,
  actions,
  openTab,
  loadTabs,
  documentId,
  ownerId,
  share,
  online,
}: {
  tab: Tab;
  tabs: readonly Tab[];
  canEdit: boolean;
  actions: FormActions;
  openTab: (tabId: string) => void;
  loadTabs?: (only?: readonly string[]) => Promise<string[]>;
  documentId: string | null;
  ownerId: string;
  share: string | null;
  // A document kept on the server (an offline one has no link to publish).
  online: boolean;
}) {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>('[data-canvas-a11y-root]'));
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // The cog's panel: the section it opened on (null, both closed), or false while shut.
  const [settings, setSettings] = useState<FormSettingsSection | null | false>(false);
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The board tabs' content, so Responses Go To can read their columns.
  const boardTabIds = tabs
    .filter((t) => t.kind === 'board')
    .map((t) => t.id)
    .join(',');
  useEffect(() => {
    if (boardTabIds) void loadTabs?.(boardTabIds.split(','));
  }, [boardTabIds, loadTabs]);

  const link = useFormLink({
    documentId,
    tabId: tab.id,
    ownerId,
    share,
    enabled: online && !!documentId,
  });
  // Switched on, but past its Close On or at its Response Limit: closed to respondents, so it reads Closed and is
  // not locked (docs/specs/030-forms/forms.md "Hearing about responses").
  // The clock, read once a minute while an open form has a Close On to pass.
  const now = useNow(!!form.closesAt && !!link.link?.link?.open, NOW_TICK_MS);
  const overdue = !!closedBySettings(form, { responses: link.link?.responses ?? 0, now });
  // A form taking responses is locked (docs/specs/030-forms/forms.md "A live form is locked"): Edit Form stops it first.
  const locked = canEdit && !!link.link?.link?.open && !overdue;
  const building = canEdit && !preview && !locked;
  // Where responses go: a Sheet (a row each) when the form names one, else its board.
  const destTab = tabs.find((t) => t.id === (form.sheet?.tabId ?? form.destination?.tabId));
  const problem = form.sheet
    ? sheetDestinationProblem(form.sheet, sheetsOf(tabs))
    : destinationProblem(
        form.destination,
        destTab ? boardsOf(destTab).map((b) => b.setup) : [],
        types,
      );
  const type = destinationType(form.destination, types);
  // What else stops publishing (docs/specs/030-forms/forms.md "Publishing and the form link").
  const notReady = useMemo(
    () => publishProblems(form, form.sheet ? undefined : type),
    [form, type],
  );

  // Responses Go To or Settings, from wherever a fix is offered (out of Preview first).
  const openSettings = useCallback((section: FormSettingsSection | null) => {
    setPreview(false);
    setSettings(section);
  }, []);
  const select = useCallback((id: string | null, focus = false) => {
    setSelectedId(id);
    if (focus) setFocusId(id);
  }, []);
  // Preview and back start at the form's top.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [preview]);
  // Escape leaves Preview.
  useEffect(() => {
    if (!preview) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [preview]);

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
    }),
    [
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
    ],
  );
  // The header's Share is this form's while an Editor has it open (lib/form-share-store.ts).
  const published = !!link.link?.link;
  useEffect(() => {
    if (!canEdit) return;
    setFormShareHost({ published, open: () => setShareOpen(true) });
    return () => setFormShareHost(null);
  }, [canEdit, published]);
  const previewButton = (
    <Tooltip label={preview ? 'Back to Editing (Esc)' : 'Preview the form as respondents see it'}>
      <button
        type="button"
        aria-pressed={preview}
        onClick={() => setPreview((p) => !p)}
        className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition ${
          preview
            ? 'bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <EyeIcon aria-hidden />
        {preview ? 'Back to Editing' : 'Preview'}
      </button>
    </Tooltip>
  );
  const shown = publicForm(form);

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
            <CanvasCover layout={layout} marker={{ 'data-form-page': '' }}>
              <FormBuilderContext.Provider value={value}>
                <div
                  role="region"
                  aria-label={`${form.heading} form`}
                  className="flex h-full min-h-0 px-3 pt-3 max-sm:px-2"
                >
                  <div
                    ref={scrollRef}
                    className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain pb-24 max-sm:pb-[calc(6rem+env(safe-area-inset-bottom))]"
                  >
                    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
                      <FormStatusBar
                        link={link}
                        problem={problem}
                        overdue={overdue}
                        full={(plan?.items.size ?? 0) >= ITEMS_MAX}
                        canEdit={canEdit}
                        onFix={() => openSettings('destination')}
                        onOpenResponses={destTab ? () => openTab(destTab.id) : null}
                        destinationName={destTab?.name ?? null}
                        problems={formProblemCount(problem, notReady)}
                        onProblems={() => setShareOpen(true)}
                        controls={
                          canEdit ? (
                            <>
                              {previewButton}
                              {/* Learn about forms, beside the cog (as a board's help sits by its cog). */}
                              <HelpArticleLink article="planForms" />
                              {/* The cog stays an Editor's while the form is locked: its Settings (closing it, its
                                  messages) still apply; Responses Go To is locked with the form. */}
                              {!preview ? (
                                <FormSettingsButton
                                  tabs={tabs}
                                  link={link}
                                  open={settings}
                                  onOpen={setSettings}
                                  onClose={() => setSettings(false)}
                                />
                              ) : null}
                            </>
                          ) : null
                        }
                      />
                      {locked && !preview ? (
                        <FormLockedStrip onEdit={() => void link.setOpen(false)} busy={link.busy} />
                      ) : null}
                      {!canEdit ? (
                        <p className="rounded-xl bg-white/80 px-4 py-2.5 text-[13px] text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                          This is a form. Its responses become {form.sheet ? 'rows in' : 'cards on'}{' '}
                          <strong>{destTab?.name ?? (form.sheet ? 'a sheet' : 'a board')}</strong>.
                        </p>
                      ) : null}
                    </div>
                    {/* The look dresses the form alone: the status bar and the panel are the editor's. */}
                    <div className="mt-3" {...look}>
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
                        <div className="mx-auto w-full max-w-[640px]">
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
                                      // A published form counts it as a response; a Sheet's row is
                                      // always written by the api.
                                      sendToLink:
                                        (published || !!form.sheet) && documentId
                                          ? (s) =>
                                              apiSendFormPreview(
                                                ownerId,
                                                documentId,
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
        toSheet={!!form.sheet}
        onShow={(p) => {
          setShareOpen(false);
          setPreview(false);
          if ('questionId' in p) select(p.questionId, true);
          else if (p.kind === 'broken_rule')
            document
              .querySelector(`[data-form-section-id="${p.sectionId}"]`)
              ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }}
      />
    </>
  );
}
