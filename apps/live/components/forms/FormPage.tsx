'use client';

// A Form tab's page (docs/specs/030-forms/forms.md "Building a form"): drawn over the canvas area, as a Dashboard
// is (CanvasCover). An Editor builds the form in place, the Form panel beside it; Preview (and everyone who may not
// edit) sees it exactly as the form link draws it. The top right holds Preview and Share Form; the menu box, its name.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '@livediagram/document';
import {
  destinationProblem,
  destinationType,
  publicForm,
  readForm,
  type FormDefinition,
} from '@livediagram/forms';
import { Button, lucideGlyph, Tooltip, useMediaQuery } from '@livediagram/ui';
import { lucideEye, lucideSettings, lucideShare2 } from '@livediagram/icons/lucide';
import { CanvasCover } from '@/components/plan/MaximisedPlanLayer';
import { DashboardMenuName } from '@/components/plan/dashboard/DashboardMenuName';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { usePlan } from '@/components/plan/PlanContext';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { useFormLink } from '@/hooks/forms/useFormLink';
import { boardsOf } from '@/hooks/forms/form-start';
import {
  FormBuilderContext,
  type FormBuilderValue,
  type FormPanelTab,
} from './builder/form-builder-context';
import { FormBuilderColumn } from './builder/FormBuilderColumn';
import { FormSidePanel } from './builder/FormSidePanel';
import { FormStatusBar } from './FormStatusBar';
import { ShareFormDialog } from './ShareFormDialog';
import { FormFill, formAccentStyle } from './respond/FormFill';

const EyeIcon = lucideGlyph(lucideEye, 16);
const ShareIcon = lucideGlyph(lucideShare2, 16);
const PanelIcon = lucideGlyph(lucideSettings, 16);

// Wide enough for the form and its panel side by side; narrower, the panel is a sheet.
const WIDE_QUERY = '(min-width: 1100px)';

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
  const [preview, setPreview] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<FormPanelTab>('question');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const wide = useMediaQuery(WIDE_QUERY);
  const scrollRef = useRef<HTMLDivElement>(null);
  const building = canEdit && !preview;

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
  const destTab = tabs.find((t) => t.id === form.destination?.tabId);
  const problem = destinationProblem(
    form.destination,
    destTab ? boardsOf(destTab).map((b) => b.setup) : [],
    types,
  );
  const type = destinationType(form.destination, types);

  const openPanel = useCallback(
    (to: FormPanelTab) => {
      setPanelTab(to);
      if (!wide) setSheetOpen(true);
    },
    [wide],
  );
  const select = useCallback((id: string | null, focus = false) => {
    setSelectedId(id);
    if (id) setPanelTab('question');
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
      openPanel,
    }),
    [form, building, actions, selectedId, select, focusId, type, types, openPanel],
  );
  const viewBoard = destTab ? () => openTab(destTab.id) : null;
  const shown = publicForm(form);

  return (
    <>
      <span hidden ref={mark} />
      <DashboardMenuName
        tab={tab}
        kindLabel="Form"
        onRename={canEdit ? (name) => actions.renameForm(name) : undefined}
      />
      {canvas
        ? createPortal(
            <div
              data-floating-panel=""
              className={`pointer-events-auto absolute right-3 top-3 z-[var(--z-toolbar)] flex items-center gap-1 p-1 ${TOOLBAR_CARD}`}
            >
              {canEdit ? (
                <Tooltip
                  label={
                    preview ? 'Back to Editing (Esc)' : 'Preview the form as respondents see it'
                  }
                >
                  <button
                    type="button"
                    aria-pressed={preview}
                    onClick={() => setPreview((p) => !p)}
                    className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition ${
                      preview
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <EyeIcon aria-hidden />
                    {preview ? 'Back to Editing' : 'Preview'}
                  </button>
                </Tooltip>
              ) : null}
              {building && !wide ? (
                <Tooltip label="Form Panel">
                  <button
                    type="button"
                    aria-label="Form Panel"
                    aria-expanded={sheetOpen}
                    onClick={() => setSheetOpen((o) => !o)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <PanelIcon aria-hidden />
                  </button>
                </Tooltip>
              ) : null}
              {canEdit ? (
                <Button size="sm" onClick={() => setShareOpen(true)} className="h-9">
                  <ShareIcon aria-hidden />
                  Share Form
                </Button>
              ) : null}
            </div>,
            canvas,
          )
        : null}
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-form-page': '' }}>
              <FormBuilderContext.Provider value={value}>
                <div
                  role="region"
                  aria-label={`${form.heading} form`}
                  style={formAccentStyle(form.accent)}
                  className="flex h-full min-h-0 gap-4 px-3 pt-16 max-sm:px-2"
                >
                  <div
                    ref={scrollRef}
                    className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain pb-24 max-sm:pb-[calc(6rem+env(safe-area-inset-bottom))]"
                  >
                    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3">
                      <FormStatusBar
                        link={link}
                        problem={problem}
                        canEdit={canEdit}
                        boardName={destTab?.name ?? null}
                        onViewBoard={viewBoard}
                        onFix={() => {
                          setPreview(false);
                          openPanel('destination');
                        }}
                      />
                      {!canEdit ? (
                        <p className="rounded-xl bg-white/80 px-4 py-2.5 text-[13px] text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                          This is a form. Its responses become cards on{' '}
                          <strong>{destTab?.name ?? 'a board'}</strong>.
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      {building ? (
                        <FormBuilderColumn scrollRef={scrollRef} />
                      ) : (
                        <div className="mx-auto w-full max-w-[640px]">
                          <FormFill
                            key={preview ? 'preview' : 'view'}
                            form={shown}
                            draftKey={null}
                            preview
                            submit={async () => ({ kind: 'sent' })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {building && wide ? (
                    <div className="w-[340px] shrink-0 pb-24">
                      <FormSidePanel tab={panelTab} onTab={setPanelTab} tabs={tabs} link={link} />
                    </div>
                  ) : null}
                  {building && !wide && sheetOpen ? (
                    <div className="absolute inset-x-2 bottom-2 top-16 z-[4] sm:left-auto sm:w-[380px]">
                      <FormSidePanel
                        tab={panelTab}
                        onTab={setPanelTab}
                        tabs={tabs}
                        link={link}
                        onClose={() => setSheetOpen(false)}
                      />
                    </div>
                  ) : null}
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
          setPreview(false);
          openPanel('destination');
        }}
      />
    </>
  );
}
