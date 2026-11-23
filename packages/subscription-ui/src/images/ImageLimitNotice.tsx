'use client';

import {
  formatBytes,
  formatTierLimit,
  limitRow,
  TIER_NAMES,
  TIER_LIMITS,
} from '@liveworkspace/subscription';
import { Button } from '@liveworkspace/ui';
import { upgradeTier } from '../limit-copy';
import { LimitNotice } from '../LimitNotice';
import { useOwnerView } from '../provider/hooks';
import { ownerViewOf } from '../state';
import type { ImageLimitRefusal } from './image-limits';

export type ImageLimitNoticeProps = {
  /** What the server said (`imageLimitRefusalOf`). */
  refusal: ImageLimitRefusal;
  /** Too large: pick a different file. */
  onChooseAnother?: () => void;
  /** Storage full: go to where images are deleted. Drawn after the offer. */
  onManageImages?: () => void;
  className?: string;
};

const ACTION = 'relative touch-target shrink-0';

/**
 * What every app says when an upload meets a tier's limit (media.md "With Pro on"; the Images design): "This Image Is
 * Over 25 MB" over "Free takes images up to 25 MB." with Choose Another, and "Image Storage Is Full" over
 * "Your images are all safe. Delete some to upload more, or get 50 GB with Pro." with Upgrade to Pro and Manage Images.
 * The largest image is the same on every tier, so a file too large has no offer; storage's is only for someone who
 * may upgrade the owner the server named, and anyone else reads the limit and the ways on. Every number is the
 * server's, but what the tier above stores, which is the contract's own table.
 *
 * Renders nothing with Pro off (LimitNotice's rule).
 */
export function ImageLimitNotice({
  refusal,
  onChooseAnother,
  onManageImages,
  className,
}: ImageLimitNoticeProps) {
  const owner = useOwnerView(refusal.owner);
  const view = ownerViewOf(owner);
  const tier = view?.tier ?? null;

  if (refusal.kind === 'too_large') {
    const limit = formatBytes(refusal.limit);
    return (
      <LimitNotice
        limitKey="imageMaxBytes"
        // Over the limit by definition; the size itself is in the title's number.
        used={Math.max(refusal.current ?? 0, refusal.limit)}
        limit={refusal.limit}
        // No owner to offer anything to: no tier takes a larger image, so there is no upgrade and no admin to ask.
        owner={null}
        near={false}
        title={`This Image Is Over ${limit}`}
        sentence={
          tier
            ? `${TIER_NAMES[tier]} takes images up to ${limit}.`
            : `Images here can be up to ${limit}.`
        }
        primaryAction={
          onChooseAnother ? (
            <Button size="xs" className={ACTION} onClick={onChooseAnother}>
              Choose Another
            </Button>
          ) : undefined
        }
        className={className}
      />
    );
  }

  const upgradeTo = view && view.action === 'upgrade' ? upgradeTier(view) : null;
  const storesMore = upgradeTo !== null && TIER_LIMITS[upgradeTo].imageStorageBytes > refusal.limit;
  return (
    <LimitNotice
      limitKey="imageStorageBytes"
      used={refusal.limit}
      limit={refusal.limit}
      owner={owner}
      near={false}
      title="Image Storage Is Full"
      sentence={
        storesMore
          ? `Your images are all safe. Delete some to upload more, or get ${formatTierLimit(
              limitRow('imageStorageBytes'),
              upgradeTo,
            )} with ${TIER_NAMES[upgradeTo]}.`
          : 'Your images are all safe. Delete some to upload more.'
      }
      offer=""
      secondaryAction={
        onManageImages ? (
          <Button variant="secondary" size="xs" className={ACTION} onClick={onManageImages}>
            Manage Images
          </Button>
        ) : undefined
      }
      className={className}
    />
  );
}
