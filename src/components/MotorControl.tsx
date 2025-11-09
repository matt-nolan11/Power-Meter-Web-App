import React from 'react';
import { ESCType, BatteryStatusPacket, BatteryState } from '../types/ble';

interface MotorControlProps {
  escType: ESCType;
  throttle: number;
  onThrottleChange: (throttle: number) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
  batteryStatus: BatteryStatusPacket | null;
  batteryProtectionEnabled: boolean;
  cutoffVoltage: number;
}

const MotorControl: React.FC<MotorControlProps> = ({
  escType,
  throttle,
  onThrottleChange,
  running,
  onStart,
  onStop,
  disabled,
  batteryStatus,
  batteryProtectionEnabled,
  cutoffVoltage
}) => {
  const maxThrottle = escType === ESCType.UNIDIRECTIONAL ? 100 : 100;
  const minThrottle = escType === ESCType.UNIDIRECTIONAL ? 0 : -100;
  
  // Disable start button if battery cutoff is active
  const isCutoffActive = batteryProtectionEnabled && batteryStatus?.state === BatteryState.CUTOFF;
  const startButtonDisabled = disabled || isCutoffActive;

  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h3 className="panel-title">Motor Control</h3>
      
      {/* Battery Status Warnings */}
      {batteryProtectionEnabled && batteryStatus && batteryStatus.state === BatteryState.WARNING && (
        <div style={{ 
          margin: '1rem', 
          padding: '0.75rem', 
          backgroundColor: 'rgba(255, 193, 7, 0.1)', 
          border: '2px solid #ffc107', 
          borderRadius: '4px',
          color: '#ffc107',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          ⚠️ Battery voltage low ({batteryStatus.voltage.toFixed(2)}V) - approaching cutoff ({cutoffVoltage.toFixed(2)}V)
        </div>
      )}

      {batteryProtectionEnabled && batteryStatus && batteryStatus.state === BatteryState.CUTOFF && (
        <div style={{ 
          margin: '1rem', 
          padding: '0.75rem', 
          backgroundColor: 'rgba(220, 53, 69, 0.1)', 
          border: '2px solid #dc3545', 
          borderRadius: '4px',
          color: '#dc3545',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          🛑 Battery cutoff reached - ESC stopped at {batteryStatus.voltage.toFixed(2)}V
        </div>
      )}
      
      <div style={{ padding: '1rem' }}>
        <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>
          Throttle{escType === ESCType.BIDIRECTIONAL && ' (negative = reverse)'}
        </label>
        
        <div className="slider-container">
          <input
            type="range"
            className="slider"
            min={minThrottle}
            max={maxThrottle}
            step="0.5"
            value={throttle}
            onChange={(e) => onThrottleChange(parseFloat(e.target.value))}
          />
          <div className="slider-value">{throttle.toFixed(1)}%</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button
            className="button-secondary"
            onClick={() => onThrottleChange(0)}
            style={{ padding: '0.25rem 1rem', fontSize: '0.875rem' }}
            title="Reset throttle to 0%"
          >
            Zero Throttle
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
          {!running ? (
            <button
              className="button-primary"
              onClick={onStart}
              disabled={startButtonDisabled}
              style={{ 
                fontSize: '1.25rem', 
                padding: '1rem 3rem',
                cursor: isCutoffActive ? 'not-allowed' : undefined,
                opacity: isCutoffActive ? 0.5 : 1
              }}
              title={isCutoffActive ? 'Motor start disabled - battery cutoff active' : undefined}
            >
              ▶ Motor Start
            </button>
          ) : (
            <button
              className="button-danger"
              onClick={onStop}
              style={{ fontSize: '1.25rem', padding: '1rem 3rem' }}
            >
              ■ Motor Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MotorControl;
