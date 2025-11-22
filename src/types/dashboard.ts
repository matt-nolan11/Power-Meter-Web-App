export enum MetricType {
  VOLTAGE = 'voltage',
  CURRENT = 'current',
  POWER = 'power',
  THROTTLE = 'throttle',
  MOTOR_RPM = 'motorRpm',
  OUTPUT_RPM = 'outputRpm',
  ESC_VOLTAGE = 'escVoltage',
  ESC_CURRENT = 'escCurrent',
  ESC_TEMP = 'escTemp',
  ESC_STATUS = 'escStatus',
  ESC_STRESS = 'escStress',
  TIP_SPEED = 'tipSpeed',
  KINETIC_ENERGY = 'kineticEnergy'
}

export interface DataCard {
  id: string;
  metric: MetricType;
}

export interface PlotConfig {
  id: string;
  title: string;
  leftYAxis: MetricType | null;
  rightYAxis: MetricType | null;
}

export const METRIC_LABELS: Record<MetricType, string> = {
  [MetricType.VOLTAGE]: 'Voltage',
  [MetricType.CURRENT]: 'Current',
  [MetricType.POWER]: 'Power',
  [MetricType.THROTTLE]: 'Throttle',
  [MetricType.MOTOR_RPM]: 'Motor RPM',
  [MetricType.OUTPUT_RPM]: 'Output RPM',
  [MetricType.ESC_VOLTAGE]: 'ESC Voltage',
  [MetricType.ESC_CURRENT]: 'ESC Current',
  [MetricType.ESC_TEMP]: 'ESC Temperature',
  [MetricType.ESC_STATUS]: 'ESC Status',
  [MetricType.ESC_STRESS]: 'ESC Stress',
  [MetricType.TIP_SPEED]: 'Tip Speed',
  [MetricType.KINETIC_ENERGY]: 'Kinetic Energy'
};

export const METRIC_UNITS: Record<MetricType, string> = {
  [MetricType.VOLTAGE]: 'V',
  [MetricType.CURRENT]: 'A',
  [MetricType.POWER]: 'W',
  [MetricType.THROTTLE]: '%',
  [MetricType.MOTOR_RPM]: 'RPM',
  [MetricType.OUTPUT_RPM]: 'RPM',
  [MetricType.ESC_VOLTAGE]: 'V',
  [MetricType.ESC_CURRENT]: 'A',
  [MetricType.ESC_TEMP]: '°C',
  [MetricType.ESC_STATUS]: '',
  [MetricType.ESC_STRESS]: '%',
  [MetricType.TIP_SPEED]: '', // Dynamic based on user settings
  [MetricType.KINETIC_ENERGY]: 'J'
};

export const DSHOT_ONLY_METRICS = [
  MetricType.MOTOR_RPM,
  MetricType.OUTPUT_RPM,
  MetricType.ESC_VOLTAGE,
  MetricType.ESC_CURRENT,
  MetricType.ESC_TEMP,
  MetricType.ESC_STATUS,
  MetricType.ESC_STRESS,
  MetricType.TIP_SPEED,
  MetricType.KINETIC_ENERGY
];
