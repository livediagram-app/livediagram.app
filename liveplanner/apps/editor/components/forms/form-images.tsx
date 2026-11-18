'use client';

// Where a form's pictures come from (docs/specs/030-forms/forms.md "Cover", "Content blocks"): its cover's and its
// picture blocks'. The builder and Preview read them as the plan's pictures (the signed-in read, a blob URL); the form
// link's page reads them through the form's own link, which serves only the pictures the form shows. Whoever draws the
// form provides the reader; without one (a test, the Explorer's snapshot) a picture is drawn as its placeholder.
import { createContext, useContext, useEffect, useState } from 'react';

// A picture's address for an <img>, or null when it can't be shown. `release` gives a blob URL back.
export type FormImageReader = {
  src: (imageId: string) => Promise<string | null>;
  release?: (src: string) => void;
};

export const FormImageContext = createContext<FormImageReader | null>(null);

// The picture's address once read: undefined while reading, null when it can't be shown.
export function useFormImage(imageId: string | undefined): string | null | undefined {
  const reader = useContext(FormImageContext);
  const [src, setSrc] = useState<{ id: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!imageId || !reader) return;
    let live = true;
    let got: string | null = null;
    void reader.src(imageId).then(
      (s) => {
        got = s;
        if (live) setSrc({ id: imageId, src: s });
        else if (s) reader.release?.(s);
      },
      () => {
        if (live) setSrc({ id: imageId, src: null });
      },
    );
    return () => {
      live = false;
      if (got) reader.release?.(got);
    };
  }, [imageId, reader]);
  if (!imageId) return null;
  if (!reader) return null;
  return src?.id === imageId ? src.src : undefined;
}
