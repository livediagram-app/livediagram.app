// The notices that share the toast stack (liveworkspace/docs/specs/016-notifications/toasts.md "One place for
// everything that pops up"): an Inbox notice, a suggestion, livediagram's paste notice. Two small module stores, so
// a notice drawn anywhere in the tree reaches the page's one stack without a context:
//
// - **The stack's notice row**: the element the stack draws its notices into, and how many notices are mounted, so
//   the stack measures its floor while only a notice is up.
// - **The notice slot**: who holds it now. One floating notice at a time: a notice that shows claims it; a
//   suggestion shows only while nothing holds it (suggestions.md "One at a time").

type Listener = () => void;

function store() {
  const listeners = new Set<Listener>();
  return {
    tell: () => {
      for (const l of [...listeners]) l();
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// The stack's notice row. One stack per page; a nested provider draws none, so the latest registered row wins.
const rows: HTMLElement[] = [];
let mounted = 0;
const rowStore = store();

/** Registers the stack's notice row (the stack's own ref); answers the release. */
export function registerNoticeRow(el: HTMLElement): () => void {
  rows.push(el);
  rowStore.tell();
  return () => {
    const at = rows.indexOf(el);
    if (at >= 0) rows.splice(at, 1);
    rowStore.tell();
  };
}

/** The row notices are drawn into, or null with no stack on the page. */
export const noticeRow = (): HTMLElement | null => rows[rows.length - 1] ?? null;

/** Counts a notice mounted in the stack; answers the release. */
export function countNotice(): () => void {
  mounted += 1;
  rowStore.tell();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    mounted -= 1;
    rowStore.tell();
  };
}

/** How many notices are mounted in the stack. */
export const noticeCount = (): number => mounted;

/** Hears the row or the count change; answers the unsubscribe. */
export const onNoticeRow = rowStore.subscribe;

// The notice slot's holders.
const holders = new Set<symbol>();
const slotStore = store();

/** Claims the slot for a notice on show; answers the release. */
export function holdNoticeSlot(): () => void {
  const key = Symbol('notice');
  holders.add(key);
  slotStore.tell();
  return () => {
    if (holders.delete(key)) slotStore.tell();
  };
}

/** Whether a notice holds the slot. */
export const noticeSlotHeld = (): boolean => holders.size > 0;

/** Hears the slot taken or freed; answers the unsubscribe. */
export const onNoticeSlot = slotStore.subscribe;
