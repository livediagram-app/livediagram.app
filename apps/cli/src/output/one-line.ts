// Text other people chose (an author's name, a tab's name) as it may appear inside one output line: every
// control character, a line break or a terminal escape among them, becomes a space. A name holding a newline
// could otherwise forge a further `watch` / `wait` line an agent reading the output would trust, and an escape
// sequence would drive the terminal.
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export const oneLine = (text: string): string => text.replace(CONTROL, ' ');
