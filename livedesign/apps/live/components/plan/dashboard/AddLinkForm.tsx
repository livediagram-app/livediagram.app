'use client';

// Add Link on a Links card (docs/specs/026-plan/plan-tabs.md "Cards", Links): a label and an address (a site, or a tab
// picked from the address field's list), straight under the card's links. In a narrow slot the label sits over the
// address; from 448 px wide (the card's own width, a container query) they share a row, the label a third. Label takes
// focus as it opens; Enter adds, Escape cancels.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, TextInput } from '@livedesign/ui';
import { DASHBOARD_LINK_LABEL_MAX, type DashboardLink, type Tab } from '@livedesign/document';
import { LinkAddressField } from './LinkAddressField';
import { resolveLinkAddress } from './link-address';

const newId = () => crypto.randomUUID().slice(0, 8);

export function AddLinkForm({
  tabs,
  onAdd,
  onCancel,
}: {
  tabs: readonly Tab[];
  onAdd: (link: DashboardLink) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [pickedTabId, setPickedTabId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Opening in a short slot, the card's list scrolls to show the whole form.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const target = resolveLinkAddress(address, pickedTabId, tabs);
    if ('problem' in target) {
      setProblem(target.problem);
      return;
    }
    onAdd({ id: newId(), label: label.trim(), ...target });
  };
  return (
    <form
      ref={formRef}
      onSubmit={submit}
      aria-label="Add Link"
      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-2.5 dark:border-slate-700 dark:bg-slate-900/60"
      onKeyDown={(e) => {
        // Escape from the label (the address field handles its own, closing its list first).
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="flex flex-col gap-2 @md:flex-row">
        <TextInput
          compact
          aria-label="Label"
          autoFocus
          value={label}
          maxLength={DASHBOARD_LINK_LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="min-w-0 @md:w-1/3 @md:shrink-0"
        />
        <div className="min-w-0 flex-1">
          <LinkAddressField
            value={address}
            tabs={tabs}
            invalid={!!problem}
            onChange={(text) => {
              setAddress(text);
              setPickedTabId(null);
              setProblem(null);
            }}
            onPickTab={(tab) => {
              setAddress(tab.name);
              setPickedTabId(tab.id);
              setProblem(null);
            }}
            onCancel={onCancel}
          />
        </div>
      </div>
      {problem ? (
        <p role="alert" className="text-[12px] text-rose-600 dark:text-rose-400">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!address.trim()}>
          Add Link
        </Button>
      </div>
    </form>
  );
}
