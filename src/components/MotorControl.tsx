import React from 'react';
import { ESCType } from '../types/ble';

interface MotorControlProps {
  escType: ESCType;
  throttle: number;
  onThrottleChange: (throttle: number) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}

const MotorControl: React.FC<MotorControlProps> = ({
  escType,
  throttle,
  onThrottleChange,
  running,
  onStart,
  onStop,
  disabled
}) => {
  const maxThrottle = escType === ESCType.UNIDIRECTIONAL ? 100 : 100;
  const minThrottle = escType === ESCType.UNIDIRECTIONAL ? 0 : -100;

  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h3 className="panel-title">Motor Control</h3>
      
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

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          {!running ? (
            <button
              className="button-primary"
              onClick={onStart}
              disabled={disabled}
              style={{ fontSize: '1.25rem', padding: '1rem 3rem' }}
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
