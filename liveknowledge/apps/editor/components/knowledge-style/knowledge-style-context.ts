'use client';

// What the Knowledgebase Style dialog's own panels read (docs/specs/030-knowledgebase/page-surface.md "Fine-tune"):
// the knowledgebase's style and the one way to change it. The dialog provides it; the Text and Colours panels and
// the profile's previews read it, so the profile stays one constant.
import { createContext, useContext } from 'react';
import { DEFAULT_KNOWLEDGE_STYLE, type KnowledgeStyle } from '@liveknowledge/document';

export type StyleChangeKind = 'Look' | 'SeasonalLook' | 'Mashup' | 'Text' | 'Colours';

export type KnowledgeStylePanel = {
  style: KnowledgeStyle;
  // One change: shown at once, saved, one undo step.
  change: (next: KnowledgeStyle, kind: StyleChangeKind) => void;
};

export const KnowledgeStylePanelContext = createContext<KnowledgeStylePanel>({
  style: DEFAULT_KNOWLEDGE_STYLE,
  change: () => {},
});

export const useKnowledgeStylePanel = (): KnowledgeStylePanel =>
  useContext(KnowledgeStylePanelContext);
