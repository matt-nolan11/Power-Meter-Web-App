import React from 'react';
import { PWMDataPacket, DSHOTDataPacket, ESCMode } from '../types/ble';

interface DataCardsProps {
  data: PWMDataPacket | DSHOTDataPacket | null;
  mode: ESCMode;
}

const DataCards: React.FC<DataCardsProps> = ({ data, mode }) => {
  if (!data) {
    return (
      <div className="panel">
        <h3 className="panel-title">Live Data</h3>
        <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
          Waiting for data...
        </p>
      </div>
    );
  }

  const power = data.voltage * data.current;
  const isDSHOT = mode === ESCMode.DSHOT && 'rpm' in data;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Live Data</h3>
      </div>
      <div className="data-cards">
        <div className="data-card">
          <div className="data-card-label">Voltage</div>
          <div className="data-card-value">{data.voltage.toFixed(2)} V</div>
        </div>
        <div className="data-card">
          <div className="data-card-label">Current</div>
          <div className="data-card-value">{data.current.toFixed(2)} A</div>
        </div>
        <div className="data-card">
          <div className="data-card-label">Power</div>
          <div className="data-card-value">{power.toFixed(1)} W</div>
        </div>
        <div className="data-card">
          <div className="data-card-label">Throttle Setpoint</div>
          <div className="data-card-value">{data.throttle.toFixed(1)}%</div>
        </div>
        
        {isDSHOT && (
          <>
            <div className="data-card">
              <div className="data-card-label">RPM</div>
              <div className="data-card-value">{(data as DSHOTDataPacket).rpm.toLocaleString()}</div>
            </div>
            <div className="data-card">
              <div className="data-card-label">ESC Temp</div>
              <div className="data-card-value">{(data as DSHOTDataPacket).temp}°C</div>
            </div>
            <div className="data-card">
              <div className="data-card-label">ESC Voltage</div>
              <div className="data-card-value">{(data as DSHOTDataPacket).escVoltage.toFixed(2)} V</div>
            </div>
            <div className="data-card">
              <div className="data-card-label">ESC Current</div>
              <div className="data-card-value">{(data as DSHOTDataPacket).escCurrent} A</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataCards;
