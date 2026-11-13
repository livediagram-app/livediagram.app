'use client';

// Describe a Form in the editor (docs/specs/030-forms/describe-a-form.md; blueprint describe-a-form.md "Editor"): the
// dialog bound to this plan and its active tab. Who is asking (signed in, or a guest who sees the nudge), where
// responses could go (the plan's boards and sheets), and Create Form through the Form tab's actions, one undo step.
// Loaded with its own chunk when chosen.

import { useEffect, useMemo } from 'react';
import { readForm } from '@liveplanner/forms';
import { formDraftTargets, uniqueTypeLabel } from '@liveplanner/templates';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { track } from '@/lib/telemetry';
import { DescribeFormDialog } from './DescribeFormDialog';
import { draftForm } from './form-draft-client';

// Create Form's words when the tab can't take the form (locked meanwhile, or the actions not there).
export const DESCRIBE_FORM_NOT_READY =
  'This tab can’t take a form just now. Try again in a moment.';

export function DescribeFormHost({ onClose }: { onClose: () => void }) {
  const ctx = useEditorContext();
  const { tabs, activeTab } = ctx;
  const types = ctx.plan?.context.types;
  const options = useMemo(() => formDraftTargets(tabs, activeTab.id), [tabs, activeTab.id]);
  const current = useMemo(
    () => (activeTab.kind === 'form' ? (readForm(activeTab.form) ?? undefined) : undefined),
    [activeTab.kind, activeTab.form],
  );

  useEffect(() => {
    track('UI', 'Opened', 'FormDescribe');
  }, []);

  return (
    <DescribeFormDialog
      signedIn={!!ctx.accountUserId}
      // Back to this very plan and tab once signed in.
      signInHref={authHrefWithReturn(
        '/sign-in/',
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      )}
      draft={(prompt) => draftForm(ctx.selfParticipant.id, prompt)}
      options={options}
      current={current}
      typeLabelFor={(heading) => uniqueTypeLabel(heading, types ?? [])}
      onCreate={(draft, target) => {
        const start = ctx.forms.startDraftedForm;
        if (!start || activeTab.locked) return DESCRIBE_FORM_NOT_READY;
        start(draft, target);
        onClose();
        return null;
      }}
      onClose={onClose}
    />
  );
}
