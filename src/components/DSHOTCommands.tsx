import React, { useState } from 'react';
import { DSHOTSpecialCommand, DSHOTResponsePacket } from '../types/ble';

interface DSHOTCommandsProps {
  onSendCommand: (command: DSHOTSpecialCommand) => Promise<void>;
  escInfo: DSHOTResponsePacket | null;
  escConnected: boolean;
}

const DSHOTCommands: React.FC<DSHOTCommandsProps> = ({
  onSendCommand,
  escInfo,
  escConnected
}) => {
  const [sending, setSending] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  const handleCommand = async (command: DSHOTSpecialCommand, name: string) => {
    setSending(true);
    setLastCommand(name);
    try {
      await onSendCommand(command);
    } catch (error) {
      console.error('Failed to send DSHOT command:', error);
    } finally {
      setSending(false);
      setTimeout(() => setLastCommand(''), 2000);
    }
  };

  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h3 
        className="panel-title"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>DSHOT Special Commands</span>
        <span style={{ fontSize: '1.2rem' }}>{expanded ? '▼' : '▶'}</span>
      </h3>
      
      {expanded && (
      <div style={{ padding: '1rem' }}>
        {/* Connection Warning */}
        {!escConnected && (
          <div style={{ 
            marginBottom: '1rem',
            padding: '0.75rem', 
            backgroundColor: 'rgba(100, 100, 100, 0.1)', 
            border: '2px solid #666', 
            borderRadius: '4px',
            color: '#aaa',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            ⚠️ ESC not connected - Connect ESC in configuration panel first
          </div>
        )}

        {/* ESC Information - Hidden for now (ESC info reading not supported by most ESCs/library) */}
        {/* <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ margin: 0 }}>ESC Information</label>
            <button
              className="button-secondary"
              onClick={() => handleCommand(DSHOTSpecialCommand.ESC_INFO, 'Request Info')}
              disabled={sending || !escConnected}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {sending && lastCommand === 'Request Info' ? 'Reading...' : '🔍 Read Info'}
            </button>
          </div>
          {escInfo && escInfo.type === 'info' && escInfo.data && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: '#2a2a2a', 
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              <div>Firmware: v{escInfo.data.firmwareVersion || 'Unknown'}</div>
              <div>Direction: {escInfo.data.rotationDirection === 1 ? 'Normal' : 'Reversed'}</div>
              <div>3D Mode: {escInfo.data.mode3D ? 'Enabled' : 'Disabled'}</div>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem', fontStyle: 'italic' }}>
                Note: ESC info may take several seconds to read and depends on ESC firmware support.
              </p>
            </div>
          )}
        </div> */}

        {/* Motor Direction */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>Motor Direction</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="button-secondary"
              onClick={() => handleCommand(DSHOTSpecialCommand.SPIN_DIRECTION_NORMAL, 'Normal Direction')}
              disabled={sending || !escConnected}
              style={{ flex: 1, padding: '0.75rem' }}
            >
              {sending && lastCommand === 'Normal Direction' ? '...' : '↻ Normal'}
            </button>
            <button
              className="button-secondary"
              onClick={() => handleCommand(DSHOTSpecialCommand.SPIN_DIRECTION_REVERSED, 'Reverse Direction')}
              disabled={sending || !escConnected}
              style={{ flex: 1, padding: '0.75rem' }}
            >
              {sending && lastCommand === 'Reverse Direction' ? '...' : '↺ Reverse'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
            ⚠️ Test at low throttle first - direction change takes effect immediately
          </p>
        </div>

        {/* 3D Mode */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>3D Mode (Bidirectional)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="button-secondary"
              onClick={() => handleCommand(DSHOTSpecialCommand.MODE_3D_ON, '3D Mode On')}
              disabled={sending || !escConnected}
              style={{ flex: 1, padding: '0.75rem' }}
            >
              {sending && lastCommand === '3D Mode On' ? '...' : 'Enable 3D'}
            </button>
            <button
              className="button-secondary"
              onClick={() => handleCommand(DSHOTSpecialCommand.MODE_3D_OFF, '3D Mode Off')}
              disabled={sending || !escConnected}
              style={{ flex: 1, padding: '0.75rem' }}
            >
              {sending && lastCommand === '3D Mode Off' ? '...' : 'Disable 3D'}
            </button>
          </div>
        </div>

        {/* Beeper */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>Beeper</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map(num => (
              <button
                key={num}
                className="button-secondary"
                onClick={() => handleCommand(num as DSHOTSpecialCommand, `Beep ${num}`)}
                disabled={sending || !escConnected}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                {sending && lastCommand === `Beep ${num}` ? '...' : `🔊 Beep ${num}`}
              </button>
            ))}
          </div>
        </div>

        {/* LED Control */}
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>LED Control</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {[0, 1, 2, 3].map(led => (
              <React.Fragment key={led}>
                <button
                  className="button-secondary"
                  onClick={() => handleCommand((22 + led) as DSHOTSpecialCommand, `LED${led} On`)}
                  disabled={sending || !escConnected}
                  style={{ padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  💡 {led} On
                </button>
              </React.Fragment>
            ))}
            {[0, 1, 2, 3].map(led => (
              <button
                key={`off-${led}`}
                className="button-secondary"
                onClick={() => handleCommand((26 + led) as DSHOTSpecialCommand, `LED${led} Off`)}
                disabled={sending || !escConnected}
                style={{ padding: '0.5rem', fontSize: '0.75rem' }}
              >
                ⚫ {led} Off
              </button>
            ))}
          </div>
        </div>

        {/* Save Settings */}
        <div className="form-group">
          <button
            className="button-primary"
            onClick={() => handleCommand(DSHOTSpecialCommand.SAVE_SETTINGS, 'Save Settings')}
            disabled={sending || !escConnected}
            style={{ width: '100%', padding: '0.75rem 1rem' }}
          >
            {sending && lastCommand === 'Save Settings' ? 'Saving...' : '💾 Save Settings to ESC'}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem', textAlign: 'center' }}>
            Saves current ESC configuration to EEPROM
          </p>
        </div>
      </div>
      )}
    </div>
  );
};

export default DSHOTCommands;
