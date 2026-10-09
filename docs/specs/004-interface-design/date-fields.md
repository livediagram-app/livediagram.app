# Date fields

Status: shipped

## What

Every date and time field (`date`, `datetime-local`, `time`, `month`) in every app fits the box it is
laid out in, on a phone and a tablet as on a desktop. A date field is as wide as the column it sits
in and never wider: the Plan card panel's Start, Due and custom Date fields, the decision record's
Date, and any later one.

## Why

iOS and iPadOS Safari draw a native date field as a centred pill with an intrinsic minimum width.
That minimum beat the field's own full width, so in a narrow column (the card panel on a phone, its
two-column field grid on an iPad) the field ran past the panel's edge and pushed the page sideways.

## The rule

- **Default, everywhere.** The shared theme (`@livediagram/tailwind-config`) gives every date and
  time field no minimum width and a maximum of its container, so a field does nothing to fit.
- **On touch WebKit** (iOS and iPadOS) the native pill is dropped: the field draws with its own
  border, padding and type like any text field, the value sits left-aligned, and an empty field keeps
  one line's height. Tapping still opens the system date picker.
- **Desktop browsers** keep their native look and calendar icon.
- In the base layer, so a field's own utilities still win.

## Typing and saving

A date field (`DateInput` in `@livediagram/ui`) saves a date only once it is whole, so typing one
in a segment at a time never loses what is already there.

- **A whole date saves at once.** Picking a day from the calendar, or typing the last digit of a
  four-digit year, saves it. A year below 1000 is still being typed (the browser reads the first digit
  of 2026 as the year 0002), so it never saves; years run from 1000 to 9999 and no further.
- **A part-typed date waits.** While any segment is empty or the year is short, nothing is saved and
  nothing is cleared: the day and month stay as typed.
- **Leaving a part-typed date puts the saved one back**, as does Escape. Nothing half-typed is ever
  kept, and the field never shows a date that is not saved.
- **Clearing every segment** (or the browser's clear button) clears the date.
- **A change from elsewhere** (a collaborator, undo) shows in the field at once, except while
  the field has focus, so it never overwrites typing in progress.

The Plan card panel's Start, Due and custom Date fields and the decision record's Date all use it.

## A dropdown on a date opens the picker

Where a date is chosen from a dropdown rather than typed (a Start or Due column in a
sheet's card table), the dropdown opens the system date picker straight away, anchored to the cell.
There is no popover holding a second date field. Typing a date stays in the cell itself.

## Showing a date

A card's saved date reads the same way wherever Plan shows it: day, short month and year ("30 Oct 2026") in the card
panel and its custom fields; day and short month ("30 Oct") on a board card, where room is
tight; day, long month and year ("30 October 2026") on a card's slide. All of them go through one
`dayLabel` helper, in the viewer's locale.
