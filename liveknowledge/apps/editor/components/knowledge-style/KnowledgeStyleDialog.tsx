'use client';

// Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the platform's Tab
// Style dialog (@liveworkspace/workbench), handed this product's profile and the knowledgebase's style in place of
// a tab's. A pick is previewed at once on this screen only; closing with a change asks first, because the style is
// the whole knowledgebase's (owner 2026-11-21): Apply to Knowledgebase saves it for everyone as one undo step,
// Discard puts the saved style back. Loaded on demand, the profile with it. Editor only: its host draws it for no one else, and the
// change door (lib/knowledge-style/style-change.ts) is bound for no one else.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KnowledgeStyle } from '@liveknowledge/document';
import { useConfirm } from '@liveworkspace/workbench/hooks/ui/useConfirm';
import { TabStyleDialog } from '@liveworkspace/workbench/components/dialogs/tab-style/TabStyleDialog';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { changeKnowledgeStyle, styleChangeBound } from '@/lib/knowledge-style/style-change';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import {
  knowledgeLookById,
  lookSettingsOf,
  withKnowledgeLook,
  type KnowledgeLook,
} from '@/lib/knowledge-style/knowledge-looks';
import { track } from '@/lib/telemetry';
import {
  KnowledgeStylePanelContext,
  type KnowledgeStylePanel,
  type StyleChangeKind,
} from './knowledge-style-context';
import { knowledgeStyleProfile } from './knowledge-style-profile';
import { useOpenKnowledgeId, useOpenKnowledgeStyle } from './useOpenKnowledgeStyle';

const noop = () => {};

export function KnowledgeStyleDialog({
  view,
  onViewChange,
  onClose,
}: {
  view: TabStyleView;
  onViewChange: (view: TabStyleView) => void;
  onClose: () => void;
}) {
  const id = useOpenKnowledgeId();
  const style = useOpenKnowledgeStyle();
  const confirm = useConfirm();
  // The style as saved when the dialog opened, and the picks not yet applied (their last telemetry kind with them).
  const saved = useRef(style);
  const [draft, setDraft] = useState<{ style: KnowledgeStyle; kinds: Set<StyleChangeKind> } | null>(
    null,
  );
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  // Closed or unmounted with picks unapplied (a role change, a reload of the page), the saved style comes back.
  useEffect(
    () => () => {
      if (draftRef.current && id) knowledgeStyleStore.set(id, saved.current);
    },
    [id],
  );
  const panel = useMemo<KnowledgeStylePanel>(
    () => ({
      style,
      change: (next, kind) => {
        if (!id || !styleChangeBound()) return;
        // A preview on this screen only: the store shows it, nothing is saved or sent.
        knowledgeStyleStore.set(id, next);
        setDraft((d) => ({ style: next, kinds: new Set([...(d?.kinds ?? []), kind]) }));
      },
    }),
    [style, id],
  );
  const close = async () => {
    const pending = draftRef.current;
    if (!pending || !id) return onClose();
    const apply = await confirm({
      title: 'Apply This Style to the Whole Knowledgebase?',
      message: 'Every page of this knowledgebase takes this style, for everyone who reads it.',
      confirmLabel: 'Apply to Knowledgebase',
      cancelLabel: 'Discard Changes',
    });
    // The saved style goes back first, so the apply is a change from it (one undo step), or the discard is done.
    knowledgeStyleStore.set(id, saved.current);
    setDraft(null);
    draftRef.current = null;
    if (apply && changeKnowledgeStyle(pending.style)) {
      // The Tab Style events (docs/specs/017-telemetry/telemetry.md): a preset type, never what was picked.
      for (const kind of pending.kinds) track('Tab', 'Changed', kind);
    }
    onClose();
  };
  const profile = useMemo(() => knowledgeStyleProfile(style), [style]);
  const applyLook = (picked: string | KnowledgeLook) => {
    const look = typeof picked === 'string' ? knowledgeLookById(picked) : picked;
    if (!look) return;
    panel.change(
      withKnowledgeLook(style, look),
      look.id === 'mashup' ? 'Mashup' : look.season ? 'SeasonalLook' : 'Look',
    );
  };
  const worn = lookSettingsOf(style);
  return (
    <KnowledgeStylePanelContext.Provider value={panel}>
      <TabStyleDialog
        profile={profile}
        tab={view}
        onTabChange={onViewChange}
        themeId={style.theme}
        onSetTheme={noop}
        // The one typeface when the headings and the body share it: what a look is matched on.
        font={worn.font ?? null}
        onSetFont={noop}
        defaultTextSize={undefined}
        onSetDefaultTextSize={noop}
        // A knowledgebase has no finish and no canvas: every page is the plain one on the app's ground.
        finish={undefined}
        onSetFinish={noop}
        backgroundPattern="blank"
        backgroundColor=""
        patternColor=""
        backgroundOpacity={1}
        backgroundPatternScale={1}
        onSetBackgroundPattern={noop}
        onSetBackgroundColor={noop}
        onSetPatternColor={noop}
        onSetBackgroundOpacity={noop}
        onSetBackgroundPatternScale={noop}
        onApplyLook={applyLook}
        onClose={() => void close()}
      />
    </KnowledgeStylePanelContext.Provider>
  );
}
