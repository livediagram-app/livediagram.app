'use client';

// The Form panel (docs/specs/030-forms/forms.md "The Form panel"): beside the form on a wide screen, a sheet over it
// on a phone, with three tabs: Question (the selected question's type, where its answer goes and its settings),
// Responses Go To and Settings. An Editor's alone.
import { QUESTION_TYPE_NAMES, promptOf } from '@livediagram/forms';
import type { Tab } from '@livediagram/document';
import { CloseIcon } from '@livediagram/ui';
import { questionById, setQuestionType } from '@/hooks/forms/form-edits';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { AnswerGoesTo } from './AnswerGoesTo';
import { DestinationPicker } from './DestinationPicker';
import { FormSettingsTab } from './FormSettingsTab';
import { QuestionSettings } from './QuestionSettings';
import { QuestionTypeMenu, TypeButtonFace } from './QuestionTypeMenu';
import { useFormBuilder, type FormPanelTab } from './form-builder-context';

const TABS: { id: FormPanelTab; name: string }[] = [
  { id: 'question', name: 'Question' },
  { id: 'destination', name: 'Responses Go To' },
  { id: 'settings', name: 'Settings' },
];

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </h3>
  );
}

export function FormSidePanel({
  tab,
  onTab,
  tabs,
  link,
  onClose,
}: {
  tab: FormPanelTab;
  onTab: (tab: FormPanelTab) => void;
  tabs: readonly Tab[];
  link: FormLinkState;
  // A phone's sheet closes; the wide panel has nothing to close.
  onClose?: () => void;
}) {
  const b = useFormBuilder();
  const q = questionById(b.form, b.selectedId);
  return (
    <aside
      aria-label="Form panel"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center border-b border-slate-100 px-2 pt-1 dark:border-slate-800">
        <div role="tablist" aria-label="Form panel" className="flex flex-1 gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={`-mb-px cursor-pointer border-b-2 px-2.5 py-2 text-[12px] font-semibold transition ${
                tab === t.id
                  ? 'border-brand-600 text-slate-900 dark:border-brand-400 dark:text-slate-50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close the form panel"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <CloseIcon size={14} />
          </button>
        ) : null}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {tab === 'question' ? (
          q ? (
            <div className="flex flex-col gap-5">
              <p className="truncate text-[14px] font-semibold text-slate-900 dark:text-slate-50">
                {promptOf(q)}
              </p>
              <section>
                <Heading>Type</Heading>
                <QuestionTypeMenu
                  value={q.type}
                  label="Question type"
                  onPick={(t) => b.actions.changeForm((f) => setQuestionType(f, q.id, t))}
                  className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <TypeButtonFace type={q.type} />
                </QuestionTypeMenu>
                <span className="sr-only">{QUESTION_TYPE_NAMES[q.type]}</span>
              </section>
              <section>
                <Heading>Answer Goes To</Heading>
                <AnswerGoesTo question={q} />
              </section>
              <section>
                <Heading>Settings</Heading>
                <QuestionSettings question={q} />
              </section>
            </div>
          ) : (
            <p className="py-6 text-center text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              Select a question to choose its type, where its answer goes on the card, and its
              settings.
            </p>
          )
        ) : null}
        {tab === 'destination' ? <DestinationPicker tabs={tabs} /> : null}
        {tab === 'settings' ? <FormSettingsTab link={link} /> : null}
      </div>
    </aside>
  );
}
