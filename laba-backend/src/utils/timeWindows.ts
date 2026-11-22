import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { APP_CONSTANTS } from '../config/constants';

const TIMEZONE = APP_CONSTANTS.TIMEZONE; // 'Asia/Kolkata'

/**
 * Parses time string (HH:MM or HH:MM:SS) into total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Returns current date components in IST normalized to midnight (YYYY-MM-DD 00:00:00).
 */
export function getISTWorkDate(date: Date = new Date()): Date {
  const zoned = toZonedTime(date, TIMEZONE);
  const year = zoned.getFullYear();
  const month = zoned.getMonth();
  const day = zoned.getDate();
  // Return UTC representation of midnight in IST
  return new Date(Date.UTC(year, month, day));
}

/**
 * Returns current time in minutes from midnight in IST.
 */
export function getISTCurrentMinutes(date: Date = new Date()): number {
  const zoned = toZonedTime(date, TIMEZONE);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/**
 * Validates whether the given server time falls within configured window.
 */
export function isWithinISTWindow(
  startTimeStr: string,
  endTimeStr: string,
  now: Date = new Date()
): { inWindow: boolean; currentMinutes: number; startMinutes: number; endMinutes: number } {
  const startMinutes = timeStringToMinutes(startTimeStr);
  const endMinutes = timeStringToMinutes(endTimeStr);
  const currentMinutes = getISTCurrentMinutes(now);

  const inWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  return { inWindow, currentMinutes, startMinutes, endMinutes };
}


/**
 * Converts a work date (UTC midnight representing an IST calendar day) plus an
 * "HH:MM" IST wall-clock time into the absolute instant.
 */
export function istDateTimeFromWorkDate(workDate: Date, timeStr: string): Date {
  const y = workDate.getUTCFullYear();
  const m = String(workDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(workDate.getUTCDate()).padStart(2, '0');
  const [hh, mm] = timeStr.split(':');
  return fromZonedTime(`${y}-${m}-${d}T${hh.padStart(2, '0')}:${(mm || '00').padStart(2, '0')}:00`, TIMEZONE);
}
