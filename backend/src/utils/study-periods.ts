export type StudyPeriod = {
  number: number;
  startTime: string;
  endTime: string;
};

export const STUDY_PERIODS: readonly StudyPeriod[] = [
  { number: 1, startTime: '07:00', endTime: '07:50' },
  { number: 2, startTime: '07:55', endTime: '08:45' },
  { number: 3, startTime: '08:50', endTime: '09:40' },
  { number: 4, startTime: '09:50', endTime: '10:40' },
  { number: 5, startTime: '10:45', endTime: '11:35' },
  { number: 6, startTime: '11:40', endTime: '12:30' },
  { number: 7, startTime: '13:30', endTime: '14:20' },
  { number: 8, startTime: '14:25', endTime: '15:15' },
  { number: 9, startTime: '15:20', endTime: '16:10' },
  { number: 10, startTime: '16:20', endTime: '17:10' },
  { number: 11, startTime: '17:15', endTime: '18:05' },
  { number: 12, startTime: '18:20', endTime: '19:10' },
  { number: 13, startTime: '19:15', endTime: '20:05' },
];

function parsePeriod(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(String(value).match(/\d+/)?.[0]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > STUDY_PERIODS.length) {
    throw new Error(`Ca học không hợp lệ: ${String(value)}.`);
  }
  return parsed;
}

export function resolvePeriodRange(periodStartValue: unknown, periodEndValue?: unknown, periodValue?: unknown) {
  let rangeStart = periodStartValue;
  let rangeEnd = periodEndValue;
  if (rangeStart === null || rangeStart === undefined || String(rangeStart).trim() === '') rangeStart = undefined;
  if (rangeEnd === null || rangeEnd === undefined || String(rangeEnd).trim() === '') rangeEnd = undefined;
  const periodText = periodValue === undefined || periodValue === null ? '' : String(periodValue).trim();
  const rangeMatch = periodText.match(/(\d+)\s*(?:-|to)\s*(\d+)/i) || periodText.match(/(\d+)\s*(?:–|—|đến)\s*(\d+)/i);

  if (rangeMatch && rangeStart === undefined && rangeEnd === undefined) {
    rangeStart = rangeMatch[1];
    rangeEnd = rangeMatch[2];
  } else if (rangeStart === undefined && periodText) {
    rangeStart = periodText;
  }

  if (rangeStart === undefined || rangeStart === null || String(rangeStart).trim() === '') return null;
  const start = parsePeriod(rangeStart);
  const end = parsePeriod(rangeEnd ?? rangeStart);
  if (!start || !end || end < start) throw new Error('Khoảng ca học không hợp lệ.');

  return {
    periodStart: start,
    periodEnd: end,
    startTime: STUDY_PERIODS[start - 1].startTime,
    endTime: STUDY_PERIODS[end - 1].endTime,
    label: start === end ? `Ca ${start}` : `Ca ${start}–${end}`,
  };
}

export function timeOnDate(date: Date, time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Giờ học không hợp lệ: ${time}.`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Giờ học không hợp lệ: ${time}.`);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function periodLabel(periodStart?: number | null, periodEnd?: number | null) {
  if (!periodStart || !periodEnd) return null;
  return periodStart === periodEnd ? `Ca ${periodStart}` : `Ca ${periodStart}–${periodEnd}`;
}
