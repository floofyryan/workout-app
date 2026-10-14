import type { MeasurementType, UnitSystem } from './types';
import { clean, cmToDisplay, displayToCm, displayToKg, kgToDisplay, lengthUnit, weightUnit } from './units';

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  bodyweight: 'Weight',
  bodyfat: 'Body fat',
  neck: 'Neck',
  shoulders: 'Shoulders',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  left_bicep: 'Left bicep',
  right_bicep: 'Right bicep',
  left_forearm: 'Left forearm',
  right_forearm: 'Right forearm',
  left_thigh: 'Left thigh',
  right_thigh: 'Right thigh',
  left_calf: 'Left calf',
  right_calf: 'Right calf',
};

export function measurementUnit(type: MeasurementType, units: UnitSystem): string {
  if (type === 'bodyweight') return weightUnit(units);
  if (type === 'bodyfat') return '%';
  return lengthUnit(units);
}

/** Stored value (kg / % / cm) → display value. */
export function measurementToDisplay(type: MeasurementType, value: number, units: UnitSystem): number {
  if (type === 'bodyweight') return clean(kgToDisplay(value, units), 1);
  if (type === 'bodyfat') return clean(value, 1);
  return clean(cmToDisplay(value, units), 1);
}

export function measurementFromDisplay(type: MeasurementType, value: number, units: UnitSystem): number {
  if (type === 'bodyweight') return displayToKg(value, units);
  if (type === 'bodyfat') return value;
  return displayToCm(value, units);
}
