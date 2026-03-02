import { ISODateString } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseISO(dateStr: ISODateString): Date {
  return toUtc(new Date(`${dateStr}T00:00:00Z`));
}

export function toISO(date: Date): ISODateString {
  return toUtc(date).toISOString().slice(0, 10);
}

export function addDays(dateStr: ISODateString, days: number): ISODateString {
  const date = parseISO(dateStr);
  return toISO(new Date(date.getTime() + days * DAY_MS));
}

export function diffDays(start: ISODateString, end: ISODateString): number {
  const s = parseISO(start).getTime();
  const e = parseISO(end).getTime();
  return Math.round((e - s) / DAY_MS);
}

export function durationFromDates(start: ISODateString, end: ISODateString): number {
  return diffDays(start, end) + 1;
}

export function endFromStartDuration(start: ISODateString, duration: number): ISODateString {
  return addDays(start, Math.max(1, duration) - 1);
}

export function maxDate(...dates: ISODateString[]): ISODateString {
  return dates.reduce((a, b) => (a >= b ? a : b));
}

export function minDate(...dates: ISODateString[]): ISODateString {
  return dates.reduce((a, b) => (a <= b ? a : b));
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
