function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number) {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return day;
}

function lastMondayBefore(year: number, month: number, beforeDay: number) {
  const date = new Date(year, month - 1, beforeDay);
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() - 1);
  }
  return date.getDate();
}

function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export type HolidayEntry = {
  dateKey: string;
  title: string;
};

export function getBCHolidays(year: number): HolidayEntry[] {
  const easter = getEasterDate(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);
  const goodFriday = new Date(easterDate);
  goodFriday.setDate(goodFriday.getDate() - 2);

  return [
    { dateKey: dateKey(year, 1, 1), title: "New Year's Day" },
    { dateKey: dateKey(year, 2, nthWeekdayOfMonth(year, 2, 1, 3)), title: 'Family Day' },
    {
      dateKey: dateKey(year, goodFriday.getMonth() + 1, goodFriday.getDate()),
      title: 'Good Friday',
    },
    { dateKey: dateKey(year, 5, lastMondayBefore(year, 5, 25)), title: 'Victoria Day' },
    { dateKey: dateKey(year, 7, 1), title: 'Canada Day' },
    { dateKey: dateKey(year, 8, nthWeekdayOfMonth(year, 8, 1, 1)), title: 'BC Day' },
    { dateKey: dateKey(year, 9, nthWeekdayOfMonth(year, 9, 1, 1)), title: 'Labour Day' },
    { dateKey: dateKey(year, 9, 30), title: 'National Day for Truth and Reconciliation' },
    { dateKey: dateKey(year, 10, nthWeekdayOfMonth(year, 10, 1, 2)), title: 'Thanksgiving' },
    { dateKey: dateKey(year, 11, 11), title: 'Remembrance Day' },
    { dateKey: dateKey(year, 12, 25), title: 'Christmas Day' },
  ];
}

const CHINESE_DATES: Record<number, HolidayEntry[]> = {
  2024: [
    { dateKey: '2024-02-10', title: 'Chinese New Year' },
    { dateKey: '2024-02-24', title: 'Lantern Festival' },
    { dateKey: '2024-04-04', title: 'Qingming Festival' },
    { dateKey: '2024-06-10', title: 'Dragon Boat Festival' },
    { dateKey: '2024-09-17', title: 'Mid-Autumn Festival' },
    { dateKey: '2024-12-21', title: 'Winter Solstice' },
  ],
  2025: [
    { dateKey: '2025-01-29', title: 'Chinese New Year' },
    { dateKey: '2025-02-12', title: 'Lantern Festival' },
    { dateKey: '2025-04-04', title: 'Qingming Festival' },
    { dateKey: '2025-05-31', title: 'Dragon Boat Festival' },
    { dateKey: '2025-10-06', title: 'Mid-Autumn Festival' },
    { dateKey: '2025-12-21', title: 'Winter Solstice' },
  ],
  2026: [
    { dateKey: '2026-02-17', title: 'Chinese New Year' },
    { dateKey: '2026-03-03', title: 'Lantern Festival' },
    { dateKey: '2026-04-05', title: 'Qingming Festival' },
    { dateKey: '2026-06-19', title: 'Dragon Boat Festival' },
    { dateKey: '2026-09-25', title: 'Mid-Autumn Festival' },
    { dateKey: '2026-12-22', title: 'Winter Solstice' },
  ],
  2027: [
    { dateKey: '2027-02-06', title: 'Chinese New Year' },
    { dateKey: '2027-02-20', title: 'Lantern Festival' },
    { dateKey: '2027-04-05', title: 'Qingming Festival' },
    { dateKey: '2027-06-09', title: 'Dragon Boat Festival' },
    { dateKey: '2027-09-15', title: 'Mid-Autumn Festival' },
    { dateKey: '2027-12-22', title: 'Winter Solstice' },
  ],
};

export function getChineseCulturalDates(year: number): HolidayEntry[] {
  return CHINESE_DATES[year] ?? [];
}
