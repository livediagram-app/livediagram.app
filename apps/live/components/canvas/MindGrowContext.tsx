'use client';

import { createContext, useContext } from 'react';

// How the label editor grows the next mind node (spec/118).
//
// A context rather than a prop because of where the two ends sit: the grower
// lives in editor state, and the consumer is RichTextEditor, five layers down
// behind `renderLabel` — a function that already takes fifteen positional
// arguments. Threading a sixteenth through every caller, for one shape kind,
// would tax every element in the app to serve mind nodes.
//
// Undefined outside a provider (the share view, the embed route, exports), and
// the editor simply doesn't offer the shortcut there.
type MindGrow = (id: string, kind: 'child' | 'sibling') => void;

// Takes the id rather than closing over the edited element, so the provider
// doesn't have to re-create the callback (and re-render the tree) every time
// the edit target changes.
const MindGrowContext = createContext<MindGrow | undefined>(undefined);

export const MindGrowProvider = MindGrowContext.Provider;

export function useMindGrow(): MindGrow | undefined {
  return useContext(MindGrowContext);
}
