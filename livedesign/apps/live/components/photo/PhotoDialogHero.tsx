'use client';

// The photo dialogs' header: the dialog hero header (liveworkspace/docs/specs/004-index/dialog-hero-header.md) with
// the two things every photo dialog needs of it. Its line said in fewer words where the sentence runs long, the
// whole sentence kept for screen readers ("The line"); and the focus started in the body, on the first control
// after the header, where it started before the header had a close ("Focus starts in the body").
import { useLayoutEffect, useRef } from 'react';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PhotoDialogHero({
  art,
  titleId,
  title,
  line,
  short,
  sheet = false,
  onClose,
}: {
  art: HeroArt;
  titleId: string;
  title: string;
  /** The line under the title, whole. */
  line?: string;
  /** The same in fewer words, shown in its place when the whole would be cut short. */
  short?: string;
  /** The dialog is a sheet on a phone (`phoneSheet`): the band runs up under its grab handle. */
  sheet?: boolean;
  onClose: () => void;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  // Before the dialog's focus trap looks (a layout effect runs ahead of its effect), as an `autoFocus` field would:
  // the trap keeps a focus already inside the panel. Not on a touch screen, where the trap leaves the controls
  // alone so no keyboard rises for a field nobody tapped.
  useLayoutEffect(() => {
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    for (let el = mark.current?.nextElementSibling; el; el = el.nextElementSibling) {
      if (el.hasAttribute('data-dialog-hero')) continue;
      const first = [el, ...el.querySelectorAll(FOCUSABLE)].find(
        (c): c is HTMLElement =>
          c instanceof HTMLElement && c.matches(FOCUSABLE) && c.offsetParent !== null,
      );
      if (first) return first.focus({ preventScroll: true });
    }
  }, []);
  return (
    <>
      <span ref={mark} hidden />
      <HeroDialogHeader
        art={art}
        titleId={titleId}
        title={title}
        subtitle={
          line && short && short !== line ? (
            <>
              <span aria-hidden>{short}</span>
              <span className="sr-only">{line}</span>
            </>
          ) : (
            line
          )
        }
        onClose={onClose}
        underHandle={sheet}
      />
    </>
  );
}
