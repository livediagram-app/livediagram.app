'use client';

// What the person's own tier keeps in the Library (liveworkspace/docs/specs/006-media/media.md "With Pro on" and
// walkthroughs.md "The Explorer's Walkthroughs"): the kit's usage meter, one quiet line on what each upload may be,
// and on Free the ProNote with what Pro keeps. The figures are the server's, read with the list; nothing is drawn with
// Pro off, where the list carries none.
import { formatBytes, limitsFor, type OwnerScope } from '@liveworkspace/subscription';
import { ownerViewOf, ProNote, UsageMeter } from '@liveworkspace/subscription-ui';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { useOwnerView } from '@liveworkspace/subscription-ui/provider';

/** "5 minutes", "30 minutes", "1 minute". */
export function minutesOf(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

export type LibraryUsageProps =
  | {
      kind: 'images';
      used: number;
      limit: number;
      maxImageBytes: number;
      owner: OwnerScope | null;
      compact?: boolean;
      className?: string;
    }
  | {
      kind: 'walkthroughs';
      used: number;
      /** Null keeps any number: the count alone, with no bar. */
      limit: number | null;
      maxMs: number;
      owner: OwnerScope | null;
      compact?: boolean;
      className?: string;
    };

/** The line under the meter and, on Free, what the note says Free and Pro keep. */
export function usageWords(props: LibraryUsageProps): { each: string; note: string } {
  const pro = limitsFor('pro');
  if (props.kind === 'images') {
    return {
      each: `Each image up to ${formatBytes(props.maxImageBytes)}. Your images in every app count here.`,
      note: `Free keeps ${formatBytes(props.limit)}. Pro keeps ${formatBytes(pro.imageStorageBytes)}.`,
    };
  }
  const kept =
    props.limit === null
      ? 'any number of walkthroughs'
      : `${props.limit} ${props.limit === 1 ? 'walkthrough' : 'walkthroughs'}`;
  return {
    each: `Each up to ${minutesOf(props.maxMs)}. Your walkthroughs in every app count here.`,
    note: `Free keeps ${kept} of up to ${minutesOf(props.maxMs)}. Pro keeps any number, up to ${minutesOf(pro.walkthroughMaxMs)}.`,
  };
}

export function LibraryUsage(props: LibraryUsageProps) {
  const view = ownerViewOf(useOwnerView(props.owner));
  const tier = view?.tier ?? null;
  const words = usageWords(props);
  const limitKey = props.kind === 'images' ? 'imageStorageBytes' : 'walkthroughsStored';
  // A build with Pro off draws no Pro UI, whatever a list carries (019 "The flag").
  if (!proOn()) return null;
  return (
    <section
      aria-label={props.kind === 'images' ? 'Image Storage' : 'Walkthroughs Stored'}
      data-library-usage={props.kind}
      className={props.className}
    >
      <UsageMeter
        limitKey={limitKey}
        label={props.kind === 'images' ? 'Storage' : 'Stored'}
        used={props.used}
        limit={props.limit}
        pro={tier === 'pro' || tier === 'team'}
        layout={props.compact ? 'stacked' : 'auto'}
      />
      {props.compact ? null : (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {words.each}
        </p>
      )}
      {!props.compact && tier === 'free' && props.owner ? (
        <ProNote owner={view} limitKey={limitKey} layout="box" className="mt-3">
          {words.note}
        </ProNote>
      ) : null}
    </section>
  );
}
