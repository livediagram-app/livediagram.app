// The names of preset statuses their ids can't spell back (an apostrophe is not in an id): "wont-fix" is "Won’t Fix".
// A leaf module, so presets.ts (which builds the columns) and statusLabel (which names a status no board names any more)
// both read it without an import cycle.
export const PRESET_STATUS_NAMES: Readonly<Record<string, string>> = {
  'wont-fix': 'Won’t Fix',
  'wont-do': 'Won’t Do',
};

// The name a preset gives status `status` (its own id, or one made from it: "wont-fix~ab12"), or undefined.
export function presetStatusName(status: string): string | undefined {
  return PRESET_STATUS_NAMES[status.split('~')[0]!];
}
