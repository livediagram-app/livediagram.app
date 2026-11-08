'use client';

import { createContext, useContext } from 'react';

// Whether the Account section above draws the API tokens in place (the host handed it `renderTokens`). An editor's own
// API Tokens row (its workbench pairings) folds in under the Account section's, and reads this to leave out its way to
// the tokens elsewhere: they are made right above it.
export const AccountTokensInPlace = createContext(false);

export function useAccountTokensInPlace(): boolean {
  return useContext(AccountTokensInPlace);
}
