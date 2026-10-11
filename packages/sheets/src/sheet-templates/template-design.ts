// A sheet template's design (docs/specs/029-sheets/sheet.md "Sheet templates"), dated from now: kept apart from the
// catalogue's names and lines (catalogue.ts) so naming a template never pulls every design into a bundle.
import { localMs, serialFromMs } from '../dates';
import type { SheetTemplateId } from './catalogue';
import type { SheetDesign } from './design';
import { budgetDesign, expensesDesign, invoiceDesign, loanDesign } from './money';
import { contactsDesign, gradesDesign, guestsDesign, habitsDesign } from './people';
import { inventoryDesign, pipelineDesign, timesheetDesign, trackerDesign } from './work';

// A template's design, dated from `now` (the Timesheet's week, the Tracker's and Contacts' dates, the Invoice's day):
// the instant `now` in this person's time zone, so its today is TODAY()'s (a template made just after midnight is
// dated that day, not the day before).
export function sheetTemplate(id: SheetTemplateId, nowMs: number): SheetDesign {
  const now = localMs(nowMs);
  const today = Math.floor(serialFromMs(now));
  switch (id) {
    case 'budget':
      return budgetDesign();
    case 'tracker':
      return trackerDesign(today);
    case 'timesheet':
      return timesheetDesign(now);
    case 'contacts':
      return contactsDesign(today);
    case 'invoice':
      return invoiceDesign(today);
    case 'expenses':
      return expensesDesign(today);
    case 'pipeline':
      return pipelineDesign(today);
    case 'inventory':
      return inventoryDesign();
    case 'guests':
      return guestsDesign();
    case 'grades':
      return gradesDesign();
    case 'habits':
      return habitsDesign();
    case 'loan':
      return loanDesign();
  }
}
