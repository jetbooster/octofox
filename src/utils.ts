import { addMinutes, format, parse } from "date-fns";
import { HourMin } from "./foxCloud";
import { Rate } from "./octopus";

export const parseIsoNoMilliSeconds = (s: string) => parse(s, "yyyy-LL-dd'T'HH:mm:ss'Z'", new Date());
export const formatToIsoNoMilliseconds = (date: Date) => format(date, "yyyy-LL-dd'T'HH:mm:ss'Z'");

export const buildRangeBackwards = (d: string, steps: number): [string, string] => {
  const d2 = addMinutes(parseIsoNoMilliSeconds(d), -30 * steps)
  return [formatToIsoNoMilliseconds(d2), d];
}

export const stretchToRange = (rates: Rate[]): [string, string] => {
  const first = Object.keys(rates[0])[0];
  const last = Object.keys(rates[rates.length - 1])[0];
  const lastPlus29m = `${addMinutes(parseIsoNoMilliSeconds(last), 29).toISOString().slice(0, 19)}Z`;
  return [first, lastPlus29m]
}

export const isoToHourMin = (isoNoMillis: string): HourMin => {
  const date = parseIsoNoMilliSeconds(isoNoMillis);
  return {
    hour: date.getHours(),
    minute: date.getMinutes()
  }
}