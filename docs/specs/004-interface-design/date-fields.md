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
