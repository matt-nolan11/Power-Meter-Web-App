import React, { useState } from 'react';
import { 
  ESCConfigPacket, 
  ESCMode, 
  ESCType, 
  DSHOTDisplaySettings,
  DiameterUnit,
  MOIUnit,
  TipSpeedUnit
} from '../types/ble';

interface ESCControlProps {
  config: ESCConfigPacket;
  onConfigChange: (config: Partial<ESCConfigPacket>) => void;
  dshotSettings: DSHOTDisplaySettings;
  onDshotSettingsChange: (settings: Partial<DSHOTDisplaySettings>) => void;
  running: boolean;
  escConnected: boolean;
  onConnectESC: () => void;
  onDisconnectESC: () => void;
  cutoffVoltage: number;
  warningVoltage: number;
}

const ESCControl: React.FC<ESCControlProps> = ({
  config,
  onConfigChange,
  dshotSettings,
  onDshotSettingsChange,
  running,
  escConnected,
  onConnectESC,
  onDisconnectESC,
  cutoffVoltage,
  warningVoltage
}) => {
  const [configExpanded, setConfigExpanded] = useState(false);

  return (
    <>
      {/* ESC Configuration Card */}
      <div className="panel">
        <h3 
          className="panel-title" 
          onClick={() => setConfigExpanded(!configExpanded)}
          style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>ESC Configuration</span>
          <span style={{ fontSize: '1.2rem' }}>{configExpanded ? '▼' : '▶'}</span>
        </h3>

        {configExpanded && (
        <>
        {/* ESC Connection Section */}
        <div className="form-group" style={{ padding: '0.75rem', backgroundColor: '#2a2a2a', borderRadius: '4px', marginBottom: '1rem' }}>
          <label className="form-label" style={{ marginBottom: '0.75rem' }}>ESC Connection</label>
          
          {/* Mode and Type Settings */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mode</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={config.mode === ESCMode.PWM}
                    onChange={() => onConfigChange({ mode: ESCMode.PWM })}
                    disabled={escConnected || running}
                  />
                  <span>PWM</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={config.mode === ESCMode.DSHOT}
                    onChange={() => onConfigChange({ mode: ESCMode.DSHOT })}
                    disabled={escConnected || running}
                  />
                  <span>DSHOT</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={config.escType === ESCType.UNIDIRECTIONAL}
                    onChange={() => onConfigChange({ escType: ESCType.UNIDIRECTIONAL })}
                    disabled={escConnected || running}
                  />
                  <span>Unidirectional</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={config.escType === ESCType.BIDIRECTIONAL}
                    onChange={() => onConfigChange({ escType: ESCType.BIDIRECTIONAL })}
                    disabled={escConnected || running}
                  />
                  <span>Bidirectional</span>
                </label>
              </div>
            </div>
          </div>

          {/* Safety Warning - only show when not connected */}
          {!escConnected && (
            <div style={{ 
              marginTop: '1rem',
              padding: '0.75rem', 
              backgroundColor: 'rgba(255, 193, 7, 0.1)', 
              border: '2px solid #ffc107', 
              borderRadius: '4px',
              color: '#ffc107'
            }}>
              <strong>⚠️ Safety Warning:</strong> Ensure Mode and Type settings match your ESC configuration before connecting.
              Incorrect settings may cause unexpected motor behavior.
            </div>
          )}

          {/* Connect/Disconnect ESC Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            {!escConnected ? (
              <button
                className="button-primary"
                onClick={onConnectESC}
                style={{ padding: '0.75rem 2rem' }}
              >
                🔌 Connect ESC
              </button>
            ) : (
              <button
                className="button-secondary"
                onClick={onDisconnectESC}
                disabled={running}
                style={{ 
                  padding: '0.75rem 2rem',
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.5 : 1
                }}
                title={running ? 'Stop motor before disconnecting' : undefined}
              >
                🔌 Disconnect ESC
              </button>
            )}
          </div>
        </div>

      {config.mode === ESCMode.DSHOT && (
        <div className="form-group" style={{ padding: '0.75rem', backgroundColor: '#2a2a2a', borderRadius: '4px', marginBottom: '1rem' }}>
          <label className="form-label" style={{ marginBottom: '0.75rem' }}>DSHOT Configuration</label>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Motor Poles</label>
              <input
                type="number"
                className="form-input"
                value={config.motorPoles}
                onChange={(e) => onConfigChange({ motorPoles: parseInt(e.target.value) })}
                disabled={running}
                style={isNaN(config.motorPoles) ? { borderColor: '#ff4444' } : undefined}
              />
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid #444', margin: '0.75rem 0', paddingTop: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '0.75rem' }}>
              Optional: Configure for tip speed and kinetic energy calculations
            </p>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Diameter</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={dshotSettings.diameter}
                    onChange={(e) => onDshotSettingsChange({ diameter: parseFloat(e.target.value) })}
                    step="0.1"
                    style={isNaN(dshotSettings.diameter) ? { borderColor: '#ff4444' } : undefined}
                  />
                  <select
                    className="form-input"
                    value={dshotSettings.diameterUnit}
                    onChange={(e) => onDshotSettingsChange({ diameterUnit: e.target.value as DiameterUnit })}
                    style={{ width: 'auto' }}
                  >
                    <option value={DiameterUnit.INCHES}>inches</option>
                    <option value={DiameterUnit.MM}>mm</option>
                    <option value={DiameterUnit.CM}>cm</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Moment of Inertia (MOI)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={dshotSettings.moi}
                    onChange={(e) => onDshotSettingsChange({ moi: parseFloat(e.target.value) })}
                    step="100"
                    style={isNaN(dshotSettings.moi) ? { borderColor: '#ff4444' } : undefined}
                  />
                  <select
                    className="form-input"
                    value={dshotSettings.moiUnit}
                    onChange={(e) => onDshotSettingsChange({ moiUnit: e.target.value as MOIUnit })}
                    style={{ width: 'auto' }}
                  >
                    <option value={MOIUnit.KG_MM2}>{MOIUnit.KG_MM2}</option>
                    <option value={MOIUnit.KG_CM2}>{MOIUnit.KG_CM2}</option>
                    <option value={MOIUnit.KG_M2}>{MOIUnit.KG_M2}</option>
                    <option value={MOIUnit.G_CM2}>{MOIUnit.G_CM2}</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Gear Ratio (Motor:Output)</label>
              <input
                type="number"
                className="form-input"
                value={dshotSettings.gearRatio}
                onChange={(e) => onDshotSettingsChange({ gearRatio: parseFloat(e.target.value) })}
                step="0.1"
                style={isNaN(dshotSettings.gearRatio) ? { borderColor: '#ff4444' } : undefined}
              />
              <small style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                e.g. 1.0 = direct drive, 3.0 = 3:1 reduction (motor @ 3000 RPM → output @ 1000 RPM)
              </small>
            </div>
            
            <div className="form-group">
              <label className="form-label">Tip Speed Display Units</label>
              <select
                className="form-input"
                value={dshotSettings.tipSpeedUnit}
                onChange={(e) => onDshotSettingsChange({ tipSpeedUnit: e.target.value as TipSpeedUnit })}
              >
                <option value={TipSpeedUnit.MPH}>mph</option>
                <option value={TipSpeedUnit.MS}>m/s</option>
                <option value={TipSpeedUnit.KMH}>km/h</option>
                <option value={TipSpeedUnit.FTS}>ft/s</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {config.mode === ESCMode.PWM && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Throttle Range (μs)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                className="form-input"
                placeholder="Min"
                value={config.throttleMin}
                onChange={(e) => onConfigChange({ throttleMin: parseInt(e.target.value) })}
                disabled={running}
                style={isNaN(config.throttleMin) ? { borderColor: '#ff4444' } : undefined}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Max"
                value={config.throttleMax}
                onChange={(e) => onConfigChange({ throttleMax: parseInt(e.target.value) })}
                disabled={running}
                style={isNaN(config.throttleMax) ? { borderColor: '#ff4444' } : undefined}
              />
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <div className="form-row" style={{ gap: '1rem' }}>
          <label className="radio-label">
            <input
              type="checkbox"
              checked={config.rampUpEnabled}
              onChange={(e) => onConfigChange({ rampUpEnabled: e.target.checked })}
              disabled={running}
            />
            <span>Enable Ramp Up</span>
          </label>
          <label className="radio-label">
            <input
              type="checkbox"
              checked={config.rampDownEnabled}
              onChange={(e) => onConfigChange({ rampDownEnabled: e.target.checked })}
              disabled={running}
            />
            <span>Enable Ramp Down</span>
          </label>
        </div>
        {(config.rampUpEnabled || config.rampDownEnabled) && (
          <div className="form-row" style={{ marginTop: '0.5rem' }}>
            {config.rampUpEnabled && (
              <div className="form-group">
                <label className="form-label">Ramp Up (%/s)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.rampUpRate}
                  onChange={(e) => onConfigChange({ rampUpRate: parseInt(e.target.value) })}
                  disabled={running}
                  style={isNaN(config.rampUpRate) ? { borderColor: '#ff4444' } : undefined}
                />
              </div>
            )}
            {config.rampDownEnabled && (
              <div className="form-group">
                <label className="form-label">Ramp Down (%/s)</label>
                <input
                  type="number"
                  className="form-input"
                  value={config.rampDownRate}
                  onChange={(e) => onConfigChange({ rampDownRate: parseInt(e.target.value) })}
                  disabled={running}
                  style={isNaN(config.rampDownRate) ? { borderColor: '#ff4444' } : undefined}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-group" style={{ padding: '0.75rem', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: config.batteryProtectionEnabled ? '0.75rem' : 0 }}>
          <label className="form-label" style={{ margin: 0 }}>Battery Protection</label>
          <label className="radio-label" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={config.batteryProtectionEnabled}
              onChange={(e) => onConfigChange({ batteryProtectionEnabled: e.target.checked })}
              disabled={running}
            />
            <span>Enabled</span>
          </label>
        </div>
        {config.batteryProtectionEnabled && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cell Count</label>
                <select
                  className="form-input"
                  value={config.batteryCells}
                  onChange={(e) => onConfigChange({ batteryCells: parseInt(e.target.value) })}
                  disabled={running}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>{n}S</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cutoff per Cell (V)</label>
                <input
                  type="number"
                  className="form-input"
                  step="0.1"
                  value={config.batteryCutoff / 1000}
                  onChange={(e) => onConfigChange({ batteryCutoff: Math.round(parseFloat(e.target.value) * 1000) })}
                  disabled={running}
                  style={isNaN(config.batteryCutoff) ? { borderColor: '#ff4444' } : undefined}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Warning Delta (V)</label>
                <input
                  type="number"
                  className="form-input"
                  step="0.1"
                  value={config.batteryWarningDelta / 1000}
                  onChange={(e) => onConfigChange({ batteryWarningDelta: Math.round(parseFloat(e.target.value) * 1000) })}
                  disabled={running}
                  style={isNaN(config.batteryWarningDelta) ? { borderColor: '#ff4444' } : undefined}
                />
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#888', marginTop: '0.5rem' }}>
              <div>Cutoff voltage: {cutoffVoltage.toFixed(2)}V</div>
              <div>Warning voltage: {warningVoltage.toFixed(2)}V</div>
              <div style={{ color: '#eab308', marginTop: '0.25rem' }}>
                ⚠️ Recommended: Keep above 3.2V per cell to preserve battery health
              </div>
            </div>
          </>
        )}
      </div>
      </>
        )}
      </div>
    </>
  );
};

export default ESCControl;
