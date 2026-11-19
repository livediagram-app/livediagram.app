// The section a settings cog opens on when something outside it presses it for one (docs/specs/011-theme/
// canvas-and-theme-dialog.md "One dialog, this editor's profile"): Tab Style's Sheet Settings row asks for Sheet
// Options, its Form Settings row for the form's Settings. One-shot: the caller asks just before its press, the cog
// takes the ask as it opens, and an ask no cog took is dropped, so a later press of the cog opens as it always does.
export type SettingsCogName = 'sheet' | 'form';

let pending: { cog: SettingsCogName; section: string } | null = null;

export function requestOpenOn(cog: SettingsCogName, section: string | null): void {
  pending = section === null ? null : { cog, section };
}

// The section asked for this cog, cleared as it is taken; null when nobody asked.
export function takeOpenOn<S extends string>(cog: SettingsCogName): S | null {
  if (pending?.cog !== cog) return null;
  const { section } = pending;
  pending = null;
  return section as S;
}
