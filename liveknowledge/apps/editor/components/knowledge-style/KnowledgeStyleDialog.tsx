'use client';

// Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the platform's Tab
// Style dialog (@liveworkspace/workbench), handed this product's profile and the knowledgebase's style in place of
// a tab's. Every pick applies live to every page of the knowledgebase, for everyone, as one undo step; there is no
// Apply or Cancel. Loaded on demand, the profile with it. Editor only: its host draws it for no one else, and the
// change door (lib/knowledge-style/style-change.ts) is bound for no one else.
import { useMemo } from 'react';
import { TabStyleDialog } from '@liveworkspace/workbench/components/dialogs/tab-style/TabStyleDialog';
import type { TabStyleView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { changeKnowledgeStyle } from '@/lib/knowledge-style/style-change';
import {
  knowledgeLookById,
  lookSettingsOf,
  withKnowledgeLook,
  type KnowledgeLook,
} from '@/lib/knowledge-style/knowledge-looks';
import { track } from '@/lib/telemetry';
import { KnowledgeStylePanelContext, type KnowledgeStylePanel } from './knowledge-style-context';
import { knowledgeStyleProfile } from './knowledge-style-profile';
import { useOpenKnowledgeStyle } from './useOpenKnowledgeStyle';

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
  const style = useOpenKnowledgeStyle();
  const panel = useMemo<KnowledgeStylePanel>(
    () => ({
      style,
      change: (next, kind) => {
        // The Tab Style events (docs/specs/017-telemetry/telemetry.md): a preset type, never what was picked.
        if (changeKnowledgeStyle(next)) track('Tab', 'Changed', kind);
      },
    }),
    [style],
  );
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
        onClose={onClose}
      />
    </KnowledgeStylePanelContext.Provider>
  );
}
