'use client';

// A custom field of a built-in kind on the card face (docs/specs/026-plan/item-types.md "Custom field kinds"): drawn as
// its built-in field draws (a Person's disc, Labels' chips, a Colour's dot and name, a Checklist's progress), and an
// Image field as its thumbnail ("Image fields"). Each is named "{Field}: {value}" for assistive technology; with no
// value it is not drawn.
import type { ReactNode } from 'react';
import {
  checklistRowsProgress,
  isItemPerson,
  itemColourValue,
  voteTotalOf,
  type CustomFieldDef,
  type ItemFieldValue,
} from '@liveplanner/items';
import { ChecklistPill, LabelChips, MetaPill, VotesPill } from './plan-card-parts';
import { ColourDot, planColourName } from './ColourSwatches';
import { PersonDisc } from './PersonDisc';
import { ImageThumb } from './ImageField';
import type { PlanPalette } from './plan-palette';

/** The kinds this draws; every other custom kind is a value pill (PlanCardFace). */
export const isBuiltInKindPill = (def: CustomFieldDef): boolean =>
  def.kind === 'person' ||
  def.kind === 'labels' ||
  def.kind === 'colour' ||
  def.kind === 'checklist' ||
  def.kind === 'image' ||
  def.kind === 'votes';

export function customKindPill(
  def: CustomFieldDef,
  value: ItemFieldValue | undefined,
  palette: PlanPalette,
): ReactNode {
  switch (def.kind) {
    case 'person':
      return isItemPerson(value) ? (
        <PersonDisc key={def.id} person={value} label={`${def.label}: ${value.name}`} />
      ) : null;
    case 'labels': {
      const labels = Array.isArray(value)
        ? value.filter((l): l is string => typeof l === 'string' && l !== '')
        : [];
      return labels.length ? (
        <span key={def.id} className="contents">
          <span className="sr-only">{`${def.label}: ${labels.join(', ')}`}</span>
          <span aria-hidden className="contents">
            <LabelChips labels={labels} />
          </span>
        </span>
      ) : null;
    }
    case 'colour': {
      const colour = itemColourValue(value);
      return colour ? (
        <MetaPill key={def.id} palette={palette} label={`${def.label}: ${planColourName(colour)}`}>
          <ColourDot colour={colour} />
          <span aria-hidden className="max-w-[8rem] truncate">
            {planColourName(colour)}
          </span>
        </MetaPill>
      ) : null;
    }
    case 'checklist': {
      const progress = checklistRowsProgress(value);
      return progress ? (
        <ChecklistPill key={def.id} progress={progress} palette={palette} name={def.label} />
      ) : null;
    }
    case 'image':
      return typeof value === 'string' && value ? (
        <ImageThumb key={def.id} imageId={value} label={`${def.label}: image`} />
      ) : null;
    // A Votes field: the built-in's ▲ count, of its own votes (item-types.md "Comments and Votes fields").
    case 'votes':
      return (
        <VotesPill key={def.id} total={voteTotalOf(value)} palette={palette} name={def.label} />
      );
    default:
      return null;
  }
}
