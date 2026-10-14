import type { UnitSystem } from './types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const M_PER_MI = 1609.344;

export function weightUnit(units: UnitSystem): 'kg' | 'lb' {
  return units === 'metric' ? 'kg' : 'lb';
}

export function lengthUnit(units: UnitSystem): 'cm' | 'in' {
  return units === 'metric' ? 'cm' : 'in';
}

export function distanceUnit(units: UnitSystem): 'km' | 'mi' {
  return units === 'metric' ? 'km' : 'mi';
}

/** Rounds away floating point noise from unit conversions (e.g. 134.99999 lb → 135). */
export function clean(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function kgToDisplay(kg: number, units: UnitSystem): number {
  return units === 'metric' ? kg : kg / KG_PER_LB;
}

export function displayToKg(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : value * KG_PER_LB;
}

export function cmToDisplay(cm: number, units: UnitSystem): number {
  return units === 'metric' ? cm : cm / CM_PER_IN;
}

export function displayToCm(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : value * CM_PER_IN;
}

export function metresToDisplay(m: number, units: UnitSystem): number {
  return units === 'metric' ? m / 1000 : m / M_PER_MI;
}

export function displayToMetres(value: number, units: UnitSystem): number {
  return units === 'metric' ? value * 1000 : value * M_PER_MI;
}

/** Formats a kg weight in the user's unit, e.g. "102.5 kg". */
export function formatWeight(kg: number | null, units: UnitSystem, withUnit = true): string {
  if (kg == null) return '–';
  const v = clean(kgToDisplay(kg, units), 1);
  return withUnit ? `${v} ${weightUnit(units)}` : `${v}`;
}

export function formatDistance(m: number | null, units: UnitSystem): string {
  if (m == null) return '–';
  return `${clean(metresToDisplay(m, units), 2)} ${distanceUnit(units)}`;
}
