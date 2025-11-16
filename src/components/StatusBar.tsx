import React from 'react';

interface StatusBarProps {
  connected: boolean;
  recording: boolean;
  sampleCount: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ connected, recording, sampleCount }) => {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot ${connected ? 'connected' : ''}`}></span>
        <span>Status: {connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="status-item">
        <span className={`status-dot ${recording ? 'recording' : ''}`}></span>
        <span>
          Recording: {recording ? `● ${sampleCount.toLocaleString()} samples` : sampleCount > 0 ? `${sampleCount.toLocaleString()} samples recorded` : 'Inactive'}
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
