// The one order for names a person reads as a list (folders in the sidebar, the grid, the folder picker and the
// Details view's Name column): A to Z ignoring case and accents, with the numbers in a name read as numbers, so
// "Folder 2" comes before "Folder 10" wherever folders are listed.
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}
