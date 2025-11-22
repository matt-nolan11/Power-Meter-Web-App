import { PWMDataPacket, DSHOTDataPacket, DSHOTDisplaySettings } from '../types/ble';
import { MetricType } from '../types/dashboard';
import { getCalculatedDSHOTMetrics } from './unitConversions';

export function getMetricValue(
  data: PWMDataPacket | DSHOTDataPacket | null,
  metric: MetricType,
  dshotSettings?: DSHOTDisplaySettings
): number | null {
  if (!data) return null;

  switch (metric) {
    case MetricType.VOLTAGE:
      return data.voltage;
    case MetricType.CURRENT:
      return data.current;
    case MetricType.POWER:
      return data.voltage * data.current;
    case MetricType.THROTTLE:
      return data.throttle;
    case MetricType.MOTOR_RPM:
      return 'rpm' in data ? data.rpm : null;
    case MetricType.OUTPUT_RPM:
      if ('rpm' in data && dshotSettings) {
        // Apply gear ratio: output RPM = motor RPM / gear ratio
        return data.rpm / dshotSettings.gearRatio;
      }
      return null;
    case MetricType.ESC_VOLTAGE:
      return 'escVoltage' in data ? data.escVoltage : null;
    case MetricType.ESC_CURRENT:
      return 'escCurrent' in data ? data.escCurrent : null;
    case MetricType.ESC_TEMP:
      return 'temp' in data ? data.temp : null;
    case MetricType.ESC_STATUS:
      return 'lastStatus' in data ? data.lastStatus : null;
    case MetricType.ESC_STRESS:
      return 'stress' in data ? data.stress : null;
    case MetricType.TIP_SPEED:
      if ('rpm' in data && dshotSettings) {
        const metrics = getCalculatedDSHOTMetrics(
          data.rpm,
          dshotSettings.diameter,
          dshotSettings.diameterUnit,
          dshotSettings.moi,
          dshotSettings.moiUnit,
          dshotSettings.tipSpeedUnit,
          dshotSettings.gearRatio
        );
        return metrics.tipSpeed;
      }
      return null;
    case MetricType.KINETIC_ENERGY:
      if ('rpm' in data && dshotSettings) {
        const metrics = getCalculatedDSHOTMetrics(
          data.rpm,
          dshotSettings.diameter,
          dshotSettings.diameterUnit,
          dshotSettings.moi,
          dshotSettings.moiUnit,
          dshotSettings.tipSpeedUnit,
          dshotSettings.gearRatio
        );
        return metrics.kineticEnergy;
      }
      return null;
    default:
      return null;
  }
}

export function formatMetricValue(value: number | null, metric: MetricType): string {
  if (value === null) return 'N/A';

  switch (metric) {
    case MetricType.VOLTAGE:
    case MetricType.ESC_VOLTAGE:
      return value.toFixed(2);
    case MetricType.CURRENT:
    case MetricType.ESC_CURRENT:
      return value.toFixed(2);
    case MetricType.POWER:
      return value.toFixed(1);
    case MetricType.THROTTLE:
    case MetricType.ESC_STRESS:
      return value.toFixed(1);
    case MetricType.MOTOR_RPM:
    case MetricType.OUTPUT_RPM:
      return Math.round(value).toLocaleString();
    case MetricType.ESC_TEMP:
    case MetricType.ESC_STATUS:
      return Math.round(value).toString();
    case MetricType.TIP_SPEED:
      return value.toFixed(1);
    case MetricType.KINETIC_ENERGY:
      return value.toFixed(2);
    default:
      return value.toString();
  }
}
