// The editor's tests read dates in UTC, whatever the machine's own time zone: CI's runners are on UTC, and a
// timestamp near midnight words as the day before or after anywhere else ("12 Nov" in London, "11 Nov" in Los
// Angeles). The app itself formats in the reader's time zone; this pins only the zone the tests run in, before any
// test file makes a date. A test about another zone passes `timeZone` to its formatter.
process.env.TZ = 'UTC';
