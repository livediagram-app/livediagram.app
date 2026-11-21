// What a delete does with a picture nothing else uses (each product's docs/specs/009-elements/images.md "Deleting an
// unused picture"): ask (the default), delete it from storage, or keep it. One common setting in every app
// (`unusedImageChoice`, liveworkspace/docs/specs/003-accounts/accounts.md "Common settings"), set from Settings >
// Editor or the offer's Remember My Choice.
export const UNUSED_IMAGE_CHOICES = ['ask', 'delete', 'keep'] as const;
export type UnusedImageChoice = (typeof UNUSED_IMAGE_CHOICES)[number];

// The preference as each editor stores it among the person's preferences (lib/user-preferences.ts).
type ChoicePreference = { unusedImageChoice?: string };

export function readUnusedImageChoice(prefs: ChoicePreference): UnusedImageChoice {
  const stored = prefs.unusedImageChoice;
  return stored === 'delete' || stored === 'keep' ? stored : 'ask';
}

export function withUnusedImageChoice<P extends ChoicePreference>(
  prefs: P,
  choice: UnusedImageChoice,
): P {
  return { ...prefs, unusedImageChoice: choice };
}
