// Ask AI in the footer's Tools (liveworkspace/docs/specs/020-ask/ask.md): questions asked of the open plan, and an
// answer's sources looked at. Never a question, an answer or which AI.
// Part of the metric catalogue: import from ../metric-catalogue (./features.ts re-exports these, and stacks them
// in Dialogs & Panels).

import { chart } from '../../_shared/catalogue-helpers';

export const ASK_AI_QUESTIONS = chart(
  'UI',
  'Used',
  'Ask AI Questions',
  'A question asked of the open plan in Ask AI, in Tools.',
  { types: ['AskAi'] },
);

// A home among the UI·Opened charts: ./features.ts adds its `typeIn` to the homes Other Panels Opened leaves out.
export const ASK_AI_SOURCES_OPENED = chart(
  'UI',
  'Opened',
  'Ask AI Sources Opened',
  'An answer’s Sources opened in Ask AI, or one of them followed to its place in the plan.',
  { typeIn: (t) => t === 'AskAiSources' || t === 'AskAiSource' },
);

export const ASK_AI_ANSWERS_COPIED = chart(
  'UI',
  'Used',
  'Ask AI Answers Copied',
  'An Ask AI answer copied with Copy Answer.',
  { types: ['AskAiCopy'] },
);

export const ASK_AI_SWITCHED = chart(
  'UI',
  'Changed',
  'Ask AI Switched',
  'Answer With changed in Ask AI, to built-in AI or to a key.',
  { types: ['AskAiBuiltIn', 'AskAiKey'] },
);
