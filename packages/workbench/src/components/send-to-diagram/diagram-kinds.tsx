// The picker's kinds (liveworkspace/docs/specs/004-index/send-to-diagram.md "The picker"): Auto and the six it may
// ask for, each with its line and glyph.
import type { ReactNode } from 'react';
import type { DiagramSendKind } from '@liveworkspace/index-client';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideArrowLeftRight,
  lucideCalendarRange,
  lucideLayers,
  lucideShare2,
  lucideSparkles,
  lucideUsers,
  lucideWorkflow,
} from '@liveworkspace/icons/lucide';

export type DiagramKindCard = {
  kind: DiagramSendKind;
  label: string;
  line: string;
  icon: (p: { size?: number }) => ReactNode;
};

export const DIAGRAM_KINDS: readonly DiagramKindCard[] = [
  { kind: 'auto', label: 'Auto', line: 'AI picks', icon: lucideGlyph(lucideSparkles, 18) },
  {
    kind: 'flowchart',
    label: 'Flowchart',
    line: 'Steps, choices',
    icon: lucideGlyph(lucideWorkflow, 18),
  },
  {
    kind: 'sequence',
    label: 'Sequence',
    line: 'Who sends what',
    icon: lucideGlyph(lucideArrowLeftRight, 18),
  },
  { kind: 'mindmap', label: 'Mind Map', line: 'Topic, ideas', icon: lucideGlyph(lucideShare2, 18) },
  {
    kind: 'orgchart',
    label: 'Org Chart',
    line: 'People, teams',
    icon: lucideGlyph(lucideUsers, 18),
  },
  {
    kind: 'architecture',
    label: 'Architecture',
    line: 'Systems, links',
    icon: lucideGlyph(lucideLayers, 18),
  },
  {
    kind: 'timeline',
    label: 'Timeline',
    line: 'Events in order',
    icon: lucideGlyph(lucideCalendarRange, 18),
  },
];
