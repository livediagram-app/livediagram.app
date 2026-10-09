// What each function takes and does, in a line (blueprint sheets-engine.md "Functions"): the editor's autocomplete
// and argument hint, and the Sheet Functions help article, read it. A flat catalogue (exempt from the size rule);
// a test keeps it, the registry and formulas.md in step. Optional arguments are in [brackets]; "…" repeats.
export type FunctionDoc = { args: readonly string[]; summary: string; example: string };

// Arguments split on commas outside brackets, so a repeating "[value2, …]" stays one argument.
function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of args) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const D = (args: string, summary: string, example: string): FunctionDoc => ({
  args: splitArgs(args),
  summary,
  example,
});

export const FUNCTION_DOCS: Readonly<Record<string, FunctionDoc>> = {
  // Maths
  SUM: D('value1, [value2, …]', 'Adds numbers and the numbers in ranges', '=SUM(A2:A10)'),
  SUMIF: D(
    'range, criterion, [sum_range]',
    'Adds the cells that meet a criterion',
    '=SUMIF(B2:B10, ">100")',
  ),
  SUMIFS: D(
    'sum_range, range1, criterion1, [range2, criterion2, …]',
    'Adds the cells that meet every criterion',
    '=SUMIFS(C2:C10, A2:A10, "North", B2:B10, ">5")',
  ),
  SUMPRODUCT: D(
    'array1, [array2, …]',
    'Multiplies matching items of arrays and adds the products',
    '=SUMPRODUCT(B2:B5, C2:C5)',
  ),
  PRODUCT: D('value1, [value2, …]', 'Multiplies numbers together', '=PRODUCT(A2:A4)'),
  ABS: D('value', 'The value without its sign', '=ABS(-4)'),
  ROUND: D(
    'value, [places]',
    'Rounds to a number of decimal places, halves away from zero',
    '=ROUND(2.675, 2)',
  ),
  ROUNDUP: D('value, [places]', 'Rounds away from zero', '=ROUNDUP(3.21, 1)'),
  ROUNDDOWN: D('value, [places]', 'Rounds towards zero', '=ROUNDDOWN(3.29, 1)'),
  INT: D('value', 'Rounds down to a whole number', '=INT(7.8)'),
  TRUNC: D('value, [places]', 'Cuts off decimal places', '=TRUNC(-7.8)'),
  MOD: D(
    'dividend, divisor',
    'The remainder after division, with the sign of the divisor',
    '=MOD(10, 3)',
  ),
  POWER: D('base, exponent', 'A number raised to a power', '=POWER(2, 10)'),
  SQRT: D('value', 'The square root', '=SQRT(16)'),
  EXP: D('value', 'e raised to a power', '=EXP(1)'),
  LN: D('value', 'The natural logarithm', '=LN(10)'),
  LOG: D('value, [base]', 'The logarithm in a base (10 by default)', '=LOG(8, 2)'),
  LOG10: D('value', 'The base-10 logarithm', '=LOG10(1000)'),
  PI: D('', 'The number π', '=PI()'),
  SIGN: D('value', '1, 0 or -1 by the sign of a number', '=SIGN(-3)'),
  CEILING: D('value, [factor]', 'Rounds up to a multiple of the factor', '=CEILING(23, 5)'),
  FLOOR: D('value, [factor]', 'Rounds down to a multiple of the factor', '=FLOOR(23, 5)'),
  MROUND: D('value, factor', 'Rounds to the nearest multiple of the factor', '=MROUND(17, 5)'),
  RAND: D('', 'A random number from 0 up to 1', '=RAND()'),
  RANDBETWEEN: D('low, high', 'A random whole number between two numbers', '=RANDBETWEEN(1, 6)'),
  QUOTIENT: D('dividend, divisor', 'The whole part of a division', '=QUOTIENT(10, 3)'),
  GCD: D('value1, [value2, …]', 'The greatest common divisor', '=GCD(12, 18)'),
  LCM: D('value1, [value2, …]', 'The least common multiple', '=LCM(4, 6)'),
  FACT: D('value', 'The factorial of a number', '=FACT(5)'),
  // Statistics
  AVERAGE: D('value1, [value2, …]', 'The mean of the numbers', '=AVERAGE(B2:B10)'),
  AVERAGEIF: D(
    'range, criterion, [average_range]',
    'The mean of the cells that meet a criterion',
    '=AVERAGEIF(A2:A10, "North", B2:B10)',
  ),
  AVERAGEIFS: D(
    'average_range, range1, criterion1, [range2, criterion2, …]',
    'The mean of the cells that meet every criterion',
    '=AVERAGEIFS(C2:C10, A2:A10, "North")',
  ),
  MEDIAN: D('value1, [value2, …]', 'The middle number', '=MEDIAN(B2:B10)'),
  MODE: D('value1, [value2, …]', 'The most common number', '=MODE(B2:B10)'),
  MIN: D('value1, [value2, …]', 'The smallest number', '=MIN(B2:B10)'),
  MAX: D('value1, [value2, …]', 'The largest number', '=MAX(B2:B10)'),
  MINIFS: D(
    'min_range, range1, criterion1, [range2, criterion2, …]',
    'The smallest number among the cells that meet every criterion',
    '=MINIFS(C2:C10, A2:A10, "North")',
  ),
  MAXIFS: D(
    'max_range, range1, criterion1, [range2, criterion2, …]',
    'The largest number among the cells that meet every criterion',
    '=MAXIFS(C2:C10, A2:A10, "North")',
  ),
  COUNT: D('value1, [value2, …]', 'How many numbers there are', '=COUNT(B2:B10)'),
  COUNTA: D('value1, [value2, …]', 'How many cells are not empty', '=COUNTA(A2:A10)'),
  COUNTBLANK: D('range', 'How many cells are empty', '=COUNTBLANK(A2:A10)'),
  COUNTIF: D('range, criterion', 'How many cells meet a criterion', '=COUNTIF(A2:A10, "Done")'),
  COUNTIFS: D(
    'range1, criterion1, [range2, criterion2, …]',
    'How many rows meet every criterion',
    '=COUNTIFS(A2:A10, "Done", B2:B10, ">3")',
  ),
  LARGE: D('range, n', 'The nth largest number', '=LARGE(B2:B10, 2)'),
  SMALL: D('range, n', 'The nth smallest number', '=SMALL(B2:B10, 2)'),
  RANK: D(
    'value, range, [ascending]',
    "A number's rank in a list (largest first unless ascending)",
    '=RANK(B2, B2:B10)',
  ),
  PERCENTILE: D('range, k', 'The value at a percentile (0 to 1)', '=PERCENTILE(B2:B10, 0.9)'),
  QUARTILE: D('range, quart', 'The value at a quartile (0 to 4)', '=QUARTILE(B2:B10, 1)'),
  STDEV: D('value1, [value2, …]', 'The standard deviation of a sample', '=STDEV(B2:B10)'),
  'STDEV.P': D(
    'value1, [value2, …]',
    'The standard deviation of a whole population',
    '=STDEV.P(B2:B10)',
  ),
  VAR: D('value1, [value2, …]', 'The variance of a sample', '=VAR(B2:B10)'),
  'VAR.P': D('value1, [value2, …]', 'The variance of a whole population', '=VAR.P(B2:B10)'),
  CORREL: D('range1, range2', 'The correlation of two ranges', '=CORREL(A2:A10, B2:B10)'),
  // Logic
  IF: D(
    'condition, if_true, [if_false]',
    'One value when a condition is TRUE, another when not',
    '=IF(B2>100, "Over", "Under")',
  ),
  IFS: D(
    'condition1, value1, [condition2, value2, …]',
    'The value of the first TRUE condition',
    '=IFS(B2>90, "A", B2>80, "B", TRUE, "C")',
  ),
  SWITCH: D(
    'expression, case1, value1, [case2, value2, …], [default]',
    'The value of the case the expression equals',
    '=SWITCH(A2, 1, "One", 2, "Two", "Many")',
  ),
  AND: D('value1, [value2, …]', 'TRUE when every value is TRUE', '=AND(B2>0, C2>0)'),
  OR: D('value1, [value2, …]', 'TRUE when any value is TRUE', '=OR(B2>0, C2>0)'),
  XOR: D('value1, [value2, …]', 'TRUE when an odd number of values are TRUE', '=XOR(B2>0, C2>0)'),
  NOT: D('value', 'The opposite of TRUE or FALSE', '=NOT(B2>0)'),
  TRUE: D('', 'TRUE', '=TRUE()'),
  FALSE: D('', 'FALSE', '=FALSE()'),
  IFERROR: D('value, if_error', 'The value, or another when it is an error', '=IFERROR(A2/B2, 0)'),
  IFNA: D(
    'value, if_na',
    'The value, or another when it is #N/A',
    '=IFNA(VLOOKUP(A2, D:E, 2, FALSE), "Missing")',
  ),
  // Information
  ISBLANK: D('value', 'TRUE when a cell is empty', '=ISBLANK(A2)'),
  ISNUMBER: D('value', 'TRUE for a number', '=ISNUMBER(A2)'),
  ISTEXT: D('value', 'TRUE for text', '=ISTEXT(A2)'),
  ISLOGICAL: D('value', 'TRUE for TRUE or FALSE', '=ISLOGICAL(A2)'),
  ISERROR: D('value', 'TRUE for any error', '=ISERROR(A2/B2)'),
  ISNA: D('value', 'TRUE for #N/A', '=ISNA(MATCH(A2, D:D, 0))'),
  ISFORMULA: D('cell', 'TRUE when a cell holds a formula', '=ISFORMULA(B2)'),
  'ERROR.TYPE': D('value', 'The number of an error (1 for #DIV/0!, ...)', '=ERROR.TYPE(A2)'),
  NA: D('', 'The #N/A error', '=NA()'),
  N: D('value', 'A value as a number (text is 0)', '=N(A2)'),
  TYPE: D(
    'value',
    'The kind of a value: 1 number, 2 text, 4 TRUE/FALSE, 16 error, 64 array',
    '=TYPE(A2)',
  ),
  // Lookup
  VLOOKUP: D(
    'key, range, column, [is_sorted]',
    'Finds a key in the first column and gives a value from its row',
    '=VLOOKUP(A2, D2:F20, 3, FALSE)',
  ),
  HLOOKUP: D(
    'key, range, row, [is_sorted]',
    'Finds a key in the first row and gives a value from its column',
    '=HLOOKUP("Q3", A1:F5, 4, FALSE)',
  ),
  XLOOKUP: D(
    'key, lookup_range, result_range, [missing], [match_mode], [search_mode]',
    'Finds a key and gives the matching value from another range',
    '=XLOOKUP(A2, D:D, F:F, "Not found")',
  ),
  LOOKUP: D(
    'key, search_range, [result_range]',
    'Finds a key in a sorted range',
    '=LOOKUP(42, A2:A10, B2:B10)',
  ),
  INDEX: D(
    'range, row, [column]',
    'The cell at a row and column of a range',
    '=INDEX(A2:C10, 3, 2)',
  ),
  MATCH: D('key, range, [type]', "A key's position in a row or column", '=MATCH("Bob", A2:A10, 0)'),
  XMATCH: D(
    'key, range, [match_mode], [search_mode]',
    "A key's position, exactly or the nearest",
    '=XMATCH("Bob", A2:A10)',
  ),
  CHOOSE: D(
    'index, value1, [value2, …]',
    'The value at a position in a list',
    '=CHOOSE(2, "Low", "Mid", "High")',
  ),
  ROW: D('[cell]', 'The row number of a cell', '=ROW(B4)'),
  ROWS: D('range', 'How many rows a range has', '=ROWS(A2:A10)'),
  COLUMN: D('[cell]', 'The column number of a cell', '=COLUMN(D2)'),
  COLUMNS: D('range', 'How many columns a range has', '=COLUMNS(A1:F1)'),
  OFFSET: D(
    'cell, rows, columns, [height], [width]',
    'A range moved from a starting cell',
    '=SUM(OFFSET(A1, 1, 0, 3))',
  ),
  INDIRECT: D('reference_text, [a1]', 'The cells a text reference names', '=INDIRECT("B" & A2)'),
  // Text
  CONCAT: D('value1, [value2, …]', 'Joins values together', '=CONCAT(A2, " ", B2)'),
  CONCATENATE: D('value1, [value2, …]', 'Joins values together', '=CONCATENATE(A2, " ", B2)'),
  TEXTJOIN: D(
    'delimiter, ignore_empty, value1, [value2, …]',
    'Joins values with a delimiter',
    '=TEXTJOIN(", ", TRUE, A2:A10)',
  ),
  LEFT: D('text, [count]', 'The first characters of text', '=LEFT(A2, 3)'),
  RIGHT: D('text, [count]', 'The last characters of text', '=RIGHT(A2, 4)'),
  MID: D('text, start, count', 'Characters from the middle of text', '=MID(A2, 2, 3)'),
  LEN: D('text', 'How many characters text has', '=LEN(A2)'),
  UPPER: D('text', 'Text in capitals', '=UPPER(A2)'),
  LOWER: D('text', 'Text in small letters', '=LOWER(A2)'),
  PROPER: D('text', 'Text With Each Word Capitalised', '=PROPER(A2)'),
  TRIM: D('text', 'Text without extra spaces', '=TRIM(A2)'),
  CLEAN: D('text', 'Text without control characters', '=CLEAN(A2)'),
  SUBSTITUTE: D(
    'text, search_for, replace_with, [occurrence]',
    'Replaces text with other text',
    '=SUBSTITUTE(A2, "-", " ")',
  ),
  REPLACE: D(
    'text, start, count, new_text',
    'Replaces characters at a position',
    '=REPLACE(A2, 1, 3, "XYZ")',
  ),
  FIND: D(
    'search_for, text, [start]',
    'Where text starts in other text (case matters)',
    '=FIND("@", A2)',
  ),
  SEARCH: D(
    'search_for, text, [start]',
    'Where text starts in other text (case ignored, wildcards)',
    '=SEARCH("inv*", A2)',
  ),
  REPT: D('text, count', 'Text repeated', '=REPT("★", B2)'),
  EXACT: D('text1, text2', 'TRUE when two texts are the same, case included', '=EXACT(A2, B2)'),
  TEXT: D('value, format', 'A number as text in a format', '=TEXT(A2, "dd/mm/yyyy")'),
  VALUE: D('text', 'Text that looks like a number, as the number', '=VALUE("1,234.5")'),
  CHAR: D('number', 'The character of a code', '=CHAR(9733)'),
  CODE: D('text', 'The code of the first character', '=CODE("A")'),
  SPLIT: D(
    'text, delimiter, [split_by_each], [remove_empty]',
    'Splits text into cells across a row',
    '=SPLIT(A2, ",")',
  ),
  JOIN: D('delimiter, value1, [value2, …]', 'Joins values with a delimiter', '=JOIN(" / ", A2:C2)'),
  REGEXMATCH: D(
    'text, pattern',
    'TRUE when text matches a regular expression',
    '=REGEXMATCH(A2, "^\\d+$")',
  ),
  REGEXEXTRACT: D(
    'text, pattern',
    'The part of text that matches a regular expression',
    '=REGEXEXTRACT(A2, "\\d+")',
  ),
  REGEXREPLACE: D(
    'text, pattern, replacement',
    'Replaces what matches a regular expression',
    '=REGEXREPLACE(A2, "\\s+", " ")',
  ),
  HYPERLINK: D(
    'url, [label]',
    'A link to a web page',
    '=HYPERLINK("https://livediagram.app", "livediagram")',
  ),
  // Date and time
  TODAY: D('', "Today's date", '=TODAY()'),
  NOW: D('', 'The date and time now', '=NOW()'),
  DATE: D('year, month, day', 'A date from its parts', '=DATE(2026, 10, 8)'),
  TIME: D('hour, minute, second', 'A time from its parts', '=TIME(14, 30, 0)'),
  DATEVALUE: D('text', 'A date typed as text, as a date', '=DATEVALUE("8 Oct 2026")'),
  TIMEVALUE: D('text', 'A time typed as text, as a time', '=TIMEVALUE("2:30 pm")'),
  YEAR: D('date', 'The year of a date', '=YEAR(A2)'),
  MONTH: D('date', 'The month of a date (1 to 12)', '=MONTH(A2)'),
  DAY: D('date', 'The day of the month', '=DAY(A2)'),
  HOUR: D('time', 'The hour of a time', '=HOUR(A2)'),
  MINUTE: D('time', 'The minute of a time', '=MINUTE(A2)'),
  SECOND: D('time', 'The second of a time', '=SECOND(A2)'),
  WEEKDAY: D('date, [type]', 'The day of the week as a number', '=WEEKDAY(A2, 2)'),
  WEEKNUM: D('date, [type]', 'The week of the year', '=WEEKNUM(A2)'),
  ISOWEEKNUM: D('date', 'The ISO week of the year', '=ISOWEEKNUM(A2)'),
  EDATE: D('start, months', 'The date a number of months away', '=EDATE(A2, 3)'),
  EOMONTH: D('start, months', 'The last day of a month a number of months away', '=EOMONTH(A2, 0)'),
  DATEDIF: D(
    'start, end, unit',
    'The time between two dates in years ("Y"), months ("M") or days ("D")',
    '=DATEDIF(A2, TODAY(), "Y")',
  ),
  DAYS: D('end, start', 'The days between two dates', '=DAYS(B2, A2)'),
  NETWORKDAYS: D(
    'start, end, [holidays]',
    'The working days between two dates',
    '=NETWORKDAYS(A2, B2)',
  ),
  WORKDAY: D(
    'start, days, [holidays]',
    'The date a number of working days away',
    '=WORKDAY(A2, 10)',
  ),
  YEARFRAC: D('start, end, [basis]', 'The share of a year between two dates', '=YEARFRAC(A2, B2)'),
  // Arrays
  FILTER: D(
    'range, condition1, [condition2, …]',
    'The rows that meet every condition',
    '=FILTER(A2:C20, C2:C20>100)',
  ),
  SORT: D(
    'range, [column], [ascending], [column2, ascending2, …]',
    'A range sorted by its columns',
    '=SORT(A2:C20, 3, FALSE)',
  ),
  SORTBY: D(
    'range, by_range1, [order1], [by_range2, order2, …]',
    'A range sorted by other ranges',
    '=SORTBY(A2:A20, B2:B20, -1)',
  ),
  UNIQUE: D(
    'range, [by_column], [exactly_once]',
    'The distinct rows of a range',
    '=UNIQUE(A2:A20)',
  ),
  SEQUENCE: D('rows, [columns], [start], [step]', 'A run of numbers', '=SEQUENCE(10)'),
  TRANSPOSE: D('range', 'A range with rows and columns swapped', '=TRANSPOSE(A1:C4)'),
  ARRAYFORMULA: D(
    'formula',
    'Works a formula out over whole ranges',
    '=ARRAYFORMULA(A2:A10*B2:B10)',
  ),
  // Finance
  PMT: D(
    'rate, periods, present_value, [future_value], [type]',
    'The payment for a loan',
    '=PMT(5%/12, 60, 20000)',
  ),
  FV: D(
    'rate, periods, payment, [present_value], [type]',
    'The future value of an investment',
    '=FV(4%/12, 120, -200)',
  ),
  PV: D(
    'rate, periods, payment, [future_value], [type]',
    'The present value of payments',
    '=PV(5%/12, 60, -400)',
  ),
  NPV: D('rate, value1, [value2, …]', 'The net present value of cash flows', '=NPV(8%, B2:B6)'),
  IRR: D('values, [guess]', 'The internal rate of return of cash flows', '=IRR(B2:B6)'),
  RATE: D(
    'periods, payment, present_value, [future_value], [type], [guess]',
    'The interest rate per period',
    '=RATE(60, -400, 20000)',
  ),
  NPER: D(
    'rate, payment, present_value, [future_value], [type]',
    'How many periods a loan takes',
    '=NPER(5%/12, -400, 20000)',
  ),
  // Plan cards
  CARDCOUNT: D(
    '[field1, value1, …]',
    'How many cards match every field and value',
    '=CARDCOUNT("State", "Done")',
  ),
  CARDSUM: D(
    'sum_field, [field1, value1, …]',
    'The sum of a number field over the matching cards',
    '=CARDSUM("Estimate", "Assignee", "Sam")',
  ),
  CARD: D('number, field', 'One field of a card', '=CARD(12, "Title")'),
  CARDS: D(
    'fields, [field1, value1, …]',
    'A table of the matching cards, spilled',
    '=CARDS("Number, Title, State", "Type", "Bug")',
  ),
};
