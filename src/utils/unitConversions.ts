import { DiameterUnit, MOIUnit, TipSpeedUnit } from '../types/ble';

/**
 * Convert diameter to meters for calculations
 */
export function diameterToMeters(value: number, unit: DiameterUnit): number {
  switch (unit) {
    case DiameterUnit.INCHES:
      return value * 0.0254; // inches to meters
    case DiameterUnit.MM:
      return value / 1000; // mm to meters
    case DiameterUnit.CM:
      return value / 100; // cm to meters
    default:
      return value;
  }
}

/**
 * Convert MOI to kg·m² for calculations
 */
export function moiToKgM2(value: number, unit: MOIUnit): number {
  switch (unit) {
    case MOIUnit.KG_MM2:
      return value / 1e6; // kg·mm² to kg·m²
    case MOIUnit.KG_CM2:
      return value / 1e4; // kg·cm² to kg·m²
    case MOIUnit.KG_M2:
      return value; // already in kg·m²
    case MOIUnit.G_CM2:
      return value / 1e7; // g·cm² to kg·m²
    default:
      return value;
  }
}

/**
 * Calculate tip speed from RPM and diameter
 * @param rpm - Revolutions per minute
 * @param diameterMeters - Diameter in meters
 * @param outputUnit - Desired output unit
 * @returns Tip speed in the specified unit
 */
export function calculateTipSpeed(
  rpm: number,
  diameterMeters: number,
  outputUnit: TipSpeedUnit
): number {
  // Calculate tip speed in m/s
  // Circumference = π × diameter
  // Speed = circumference × (rpm / 60) = π × diameter × rpm / 60
  const tipSpeedMS = (Math.PI * diameterMeters * rpm) / 60;
  
  // Convert to desired unit
  switch (outputUnit) {
    case TipSpeedUnit.MS:
      return tipSpeedMS;
    case TipSpeedUnit.KMH:
      return tipSpeedMS * 3.6; // m/s to km/h
    case TipSpeedUnit.MPH:
      return tipSpeedMS * 2.23694; // m/s to mph
    case TipSpeedUnit.FTS:
      return tipSpeedMS * 3.28084; // m/s to ft/s
    default:
      return tipSpeedMS;
  }
}

/**
 * Calculate rotational kinetic energy from RPM and MOI
 * @param rpm - Revolutions per minute
 * @param moiKgM2 - Moment of inertia in kg·m²
 * @returns Kinetic energy in Joules
 */
export function calculateKineticEnergy(rpm: number, moiKgM2: number): number {
  // Convert RPM to angular velocity in rad/s
  // ω = 2π × rpm / 60
  const omega = (2 * Math.PI * rpm) / 60;
  
  // Rotational kinetic energy: KE = 0.5 × I × ω²
  return 0.5 * moiKgM2 * omega * omega;
}

/**
 * Helper to get calculated metrics with proper unit conversions
 */
export function getCalculatedDSHOTMetrics(
  rpm: number,
  diameter: number,
  diameterUnit: DiameterUnit,
  moi: number,
  moiUnit: MOIUnit,
  tipSpeedUnit: TipSpeedUnit,
  gearRatio: number = 1.0 // Motor RPM / Output RPM (default 1:1 direct drive)
): {
  tipSpeed: number;
  kineticEnergy: number;
  tipSpeedUnit: string;
} {
  const diameterM = diameterToMeters(diameter, diameterUnit);
  const moiKgM2 = moiToKgM2(moi, moiUnit);
  
  // Apply gear ratio to get actual output RPM
  // If gear ratio is 3.0, motor at 3000 RPM drives output at 1000 RPM
  const outputRpm = rpm / gearRatio;
  
  return {
    tipSpeed: calculateTipSpeed(outputRpm, diameterM, tipSpeedUnit),
    kineticEnergy: calculateKineticEnergy(outputRpm, moiKgM2),
    tipSpeedUnit: tipSpeedUnit
  };
}
