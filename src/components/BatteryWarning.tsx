import React from 'react';

interface BatteryWarningProps {
  type: 'warning' | 'error';
  voltage: number;
  cutoffVoltage: number;
}

const BatteryWarning: React.FC<BatteryWarningProps> = ({ type, voltage, cutoffVoltage }) => {
  if (type === 'warning') {
    return (
      <div className="warning-banner warning">
        ⚠️ Battery voltage low ({voltage.toFixed(2)}V) - approaching cutoff ({cutoffVoltage.toFixed(2)}V)
      </div>
    );
  }

  return (
    <div className="warning-banner error">
      🛑 Battery cutoff reached - ESC stopped at {voltage.toFixed(2)}V
    </div>
  );
};

export default BatteryWarning;
