import type { ReactNode } from 'react';

// The app's prism, drawn by the app (its UI package's BrandMark in its mono tone, white on the deep
// brand tile), at the size the class gives it.
export type Mark = (className: string) => ReactNode;
