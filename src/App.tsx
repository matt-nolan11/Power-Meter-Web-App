import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { BLEManager } from './services/BLEManager';
import { DeviceStorage } from './utils/deviceStorage';
import {
  PWMDataPacket,
  DSHOTDataPacket,
  BatteryStatusPacket,
  ESCMode,
  ESCType,
  BatteryState,
  ESCConfigPacket,
  ESCCommandPacket,
  DSHOTDisplaySettings,
  DiameterUnit,
  MOIUnit,
  TipSpeedUnit,
  DSHOTSpecialCommand,
  DSHOTResponsePacket
} from './types/ble';
import { DataCard, PlotConfig, MetricType, METRIC_LABELS, METRIC_UNITS } from './types/dashboard';
import ESCControl from './components/ESCControl.tsx';
import MotorControl from './components/MotorControl.tsx';
import StatusBar from './components/StatusBar.tsx';
import DynamicDataCards from './components/DynamicDataCards.tsx';
import PlotPanel from './components/PlotPanel.tsx';
import DSHOTCommands from './components/DSHOTCommands.tsx';

function App() {
  const [bleManager] = useState(() => new BLEManager());
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<PWMDataPacket | DSHOTDataPacket | null>(null);
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatusPacket | null>(null);
  const [recording, setRecording] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(Date.now());
  
  // Store reference to first plot's data for CSV export
  const recordedDataRef = useRef<Map<MetricType, { x: number; y: number }[]> | null>(null);
  
  // CSV export selections
  const [exportSelections, setExportSelections] = useState<Set<MetricType>>(
    new Set(Object.values(MetricType))
  );
  
  // Data cards state
  const [dataCards, setDataCards] = useState<DataCard[]>([
    { id: '1', metric: MetricType.VOLTAGE },
    { id: '2', metric: MetricType.CURRENT },
    { id: '3', metric: MetricType.POWER }
  ]);
  
  // Plots state
  const [plots, setPlots] = useState<PlotConfig[]>([
    {
      id: '1',
      title: 'Voltage + Current',
      leftYAxis: MetricType.VOLTAGE,
      rightYAxis: MetricType.CURRENT
    }
  ]);
  
  // ESC Configuration
  const [escConfig, setEscConfig] = useState<ESCConfigPacket>({
    mode: ESCMode.PWM,
    escType: ESCType.UNIDIRECTIONAL,
    throttleMin: 1000,
    throttleMax: 2000,
    rampUpRate: 50,      // %/s (changed from 500 μs/s)
    rampDownRate: 100,   // %/s (changed from 1000 μs/s)
    rampUpEnabled: true,
    rampDownEnabled: true,
    batteryCells: 4,
    batteryCutoff: 3200,        // millivolts (3.2V)
    batteryWarningDelta: 200,   // millivolts (0.2V)
    batteryProtectionEnabled: true,
    motorPoles: 14
  });

  // DSHOT Display Settings (not sent to device)
  const [dshotSettings, setDshotSettings] = useState<DSHOTDisplaySettings>({
    diameter: 10,
    diameterUnit: DiameterUnit.INCHES,
    moi: 5000,
    moiUnit: MOIUnit.KG_MM2,
    tipSpeedUnit: TipSpeedUnit.MPH
  });

  const [throttle, setThrottle] = useState(0);
  const [escRunning, setEscRunning] = useState(false);
  const [escConnected, setEscConnected] = useState(false);
  const [escInfo, setEscInfo] = useState<DSHOTResponsePacket | null>(null);
  const throttleTimeoutRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const escRunningRef = useRef(false);
  const lastBatteryStateRef = useRef<BatteryState>(BatteryState.NORMAL);

  // Keep refs in sync with state
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    escRunningRef.current = escRunning;
  }, [escRunning]);

  useEffect(() => {
    bleManager.setConnectionCallback((isConnected) => {
      setConnected(isConnected);
      if (!isConnected) {
        setEscRunning(false);
      }
    });

    bleManager.setDataCallback((data) => {
      setLatestData(data);
      // Don't increment sample count here - let PlotPanel handle it
      // to ensure count matches actual stored data points
    });

    bleManager.setBatteryCallback((status) => {
      setBatteryStatus(status);
      
      // Only act on state transitions, not every update
      if (status.state !== lastBatteryStateRef.current) {
        lastBatteryStateRef.current = status.state;
        
        // When cutoff is reached, update UI to show motor stopped
        // (Device stops automatically - no need to send command)
        if (status.state === BatteryState.CUTOFF) {
          setEscRunning(false);
          escRunningRef.current = false;
        }
      }
    });

    bleManager.setDSHOTResponseCallback((response) => {
      setEscInfo(response);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bleManager]);

  // Send config to device whenever connection is established or config changes
  useEffect(() => {
    if (connected) {
      bleManager.sendConfig(escConfig).catch(error => {
        console.error('Failed to send config:', error);
      });
    }
  }, [connected, escConfig, bleManager]);

  const handleConnect = async () => {
    try {
      await bleManager.connect();
      const connectedDeviceId = bleManager.getDeviceId();
      
      if (!connectedDeviceId) {
        throw new Error('Unable to get device ID');
      }

      setDeviceId(connectedDeviceId);
      
      // Check if this device has been connected before
      const storedDevice = DeviceStorage.getDevice(connectedDeviceId);
      
      if (storedDevice) {
        // Load saved settings
        setDeviceName(storedDevice.name);
        setEscConfig(storedDevice.config);
      } else {
        // First time connecting - prompt for name
        const defaultName = DeviceStorage.getNextDeviceName();
        const userProvidedName = prompt(
          'Enter a name for this device:',
          defaultName
        );
        
        const finalName = userProvidedName?.trim() || defaultName;
        setDeviceName(finalName);
        
        // Save initial device settings
        DeviceStorage.saveDevice(connectedDeviceId, {
          name: finalName,
          config: escConfig,
          lastConnected: Date.now()
        });
      }
      
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect to device. Make sure Bluetooth is enabled and the device is nearby.');
    }
  };

  const handleDisconnect = async () => {
    await bleManager.disconnect();
    setConnected(false);
    setEscRunning(false);
  };

  const handleStart = useCallback(async () => {
    if (!connected) return;

    try {
      // Send START command
      const command: ESCCommandPacket = {
        command: 1, // START
        throttle: throttle
      };
      await bleManager.sendCommand(command);
      
      setEscRunning(true);
    } catch (error) {
      console.error('Failed to start ESC:', error);
      alert('Failed to start ESC');
    }
  }, [connected, bleManager, throttle]);

  const handleStop = useCallback(async () => {
    if (!connected) return;

    try {
      const command: ESCCommandPacket = {
        command: 0, // STOP
        throttle: 0
      };
      await bleManager.sendCommand(command);
      
      setEscRunning(false);
    } catch (error) {
      console.error('Failed to stop ESC:', error);
    }
  }, [connected, bleManager]);

  const handleConnectESC = useCallback(async () => {
    if (!connected) return;

    try {
      const command: ESCCommandPacket = {
        command: 2, // CONNECT
        throttle: 0
      };
      await bleManager.sendCommand(command);
      
      setEscConnected(true);
    } catch (error) {
      console.error('Failed to connect ESC:', error);
      alert('Failed to connect ESC');
    }
  }, [connected, bleManager]);

  const handleDisconnectESC = useCallback(async () => {
    if (!connected) return;

    try {
      // Stop motor first if running
      if (escRunning) {
        await handleStop();
      }
      
      const command: ESCCommandPacket = {
        command: 3, // DISCONNECT
        throttle: 0
      };
      await bleManager.sendCommand(command);
      
      setEscConnected(false);
      setEscRunning(false);
    } catch (error) {
      console.error('Failed to disconnect ESC:', error);
    }
  }, [connected, escRunning, handleStop, bleManager]);

  const handleThrottleChange = useCallback(async (newThrottle: number) => {
    setThrottle(newThrottle);
    
    // If ESC is running, debounce throttle updates to avoid BLE congestion
    if (escRunning && connected) {
      // Clear any pending throttle update
      if (throttleTimeoutRef.current !== null) {
        clearTimeout(throttleTimeoutRef.current);
      }
      
      // Schedule new throttle update after 100ms of no changes
      throttleTimeoutRef.current = window.setTimeout(async () => {
        try {
          const command: ESCCommandPacket = {
            command: 1, // START (keeps it running with new throttle)
            throttle: newThrottle
          };
          await bleManager.sendCommand(command);
          throttleTimeoutRef.current = null;
        } catch (error) {
          console.error('Failed to update throttle:', error);
        }
      }, 100);
    }
  }, [escRunning, connected, bleManager]);

  const handleConfigChange = useCallback((newConfig: Partial<ESCConfigPacket>) => {
    const updatedConfig = { ...escConfig, ...newConfig };
    setEscConfig(updatedConfig);
    
    // Reset throttle to 0 whenever ESC type changes
    if (newConfig.escType !== undefined && newConfig.escType !== escConfig.escType) {
      handleThrottleChange(0);
    }
    
    // Save updated config to storage if device is connected
    if (deviceId) {
      const storedDevice = DeviceStorage.getDevice(deviceId);
      if (storedDevice) {
        DeviceStorage.saveDevice(deviceId, {
          ...storedDevice,
          config: updatedConfig
        });
      }
    }
    
    // Config will be sent automatically by useEffect
  }, [escConfig, throttle, handleThrottleChange, deviceId]);

  const handleDshotSettingsChange = (newSettings: Partial<DSHOTDisplaySettings>) => {
    const updatedSettings = { ...dshotSettings, ...newSettings };
    setDshotSettings(updatedSettings);
    
    // Save DSHOT settings to storage if device is connected
    if (deviceId) {
      const storedDevice = DeviceStorage.getDevice(deviceId);
      if (storedDevice) {
        DeviceStorage.saveDevice(deviceId, {
          ...storedDevice,
          dshotSettings: updatedSettings
        });
      }
    }
  };

  const handleSendDSHOTCommand = async (command: DSHOTSpecialCommand) => {
    if (!connected) {
      console.error('Not connected to device');
      return;
    }

    try {
      await bleManager.sendDSHOTCommand(command);
    } catch (error) {
      console.error('Failed to send DSHOT command:', error);
    }
  };

  const handleRenameDevice = () => {
    if (!deviceId) return;
    
    const newName = prompt('Enter new device name:', deviceName);
    if (newName && newName.trim()) {
      const trimmedName = newName.trim();
      setDeviceName(trimmedName);
      DeviceStorage.updateDeviceName(deviceId, trimmedName);
    }
  };

  const handleAddCard = () => {
    // Find first unused metric
    const usedMetrics = new Set(dataCards.map(card => card.metric));
    const isDSHOT = escConfig.mode === ESCMode.DSHOT;
    const availableMetrics = Object.values(MetricType).filter(metric => {
      if ([MetricType.RPM, MetricType.ESC_VOLTAGE, MetricType.ESC_CURRENT, 
           MetricType.ESC_TEMP, MetricType.ESC_STATUS, MetricType.ESC_STRESS].includes(metric)) {
        return isDSHOT;
      }
      return true;
    });
    
    const unusedMetric = availableMetrics.find(m => !usedMetrics.has(m));
    if (!unusedMetric) return; // No more metrics available
    
    const newCard: DataCard = {
      id: Date.now().toString(),
      metric: unusedMetric
    };
    setDataCards([...dataCards, newCard]);
  };

  const handleRemoveCard = (id: string) => {
    setDataCards(dataCards.filter(card => card.id !== id));
  };

  const handleChangeMetric = (id: string, metric: MetricType) => {
    setDataCards(dataCards.map(card => 
      card.id === id ? { ...card, metric } : card
    ));
  };

  const handleAddPlot = () => {
    const newPlot: PlotConfig = {
      id: Date.now().toString(),
      title: `Plot ${plots.length + 1}`,
      leftYAxis: null,
      rightYAxis: null
    };
    setPlots([...plots, newPlot]);
  };

  const handleRemovePlot = (id: string) => {
    setPlots(plots.filter(plot => plot.id !== id));
  };

  const handleUpdatePlotLeftAxis = (id: string, metric: MetricType | null) => {
    setPlots(plots.map(plot =>
      plot.id === id ? { ...plot, leftYAxis: metric } : plot
    ));
  };

  const handleUpdatePlotRightAxis = (id: string, metric: MetricType | null) => {
    setPlots(plots.map(plot =>
      plot.id === id ? { ...plot, rightYAxis: metric } : plot
    ));
  };

  const handleStartRecording = () => {
    setRecording(true);
    setRecordingStartTime(Date.now());
    setSampleCount(0);
  };

  const handleStopRecording = () => {
    setRecording(false);
  };

  const handleExportCSV = () => {
    if (!recordedDataRef.current || recordedDataRef.current.size === 0) {
      alert('No data to export. Please record some data first.');
      return;
    }

    // Generate filename: DeviceName_YYYY-MM-DD_HH-MM-SS.csv
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const sanitizedName = deviceName.replace(/\s+/g, '-');
    const filename = `${sanitizedName}_${dateStr}_${timeStr}.csv`;

    // Build CSV header
    const headers = ['Timestamp (ms)'];
    const selectedMetrics: MetricType[] = [];
    
    exportSelections.forEach(metric => {
      if (recordedDataRef.current!.has(metric)) {
        // Dynamic unit for tip speed based on user settings
        let unit = METRIC_UNITS[metric];
        if (metric === MetricType.TIP_SPEED && dshotSettings) {
          const unitMap: Record<TipSpeedUnit, string> = {
            [TipSpeedUnit.MPH]: 'mph',
            [TipSpeedUnit.MS]: 'm/s',
            [TipSpeedUnit.KMH]: 'km/h',
            [TipSpeedUnit.FTS]: 'ft/s'
          };
          unit = unitMap[dshotSettings.tipSpeedUnit];
        }
        headers.push(`${METRIC_LABELS[metric]} (${unit})`);
        selectedMetrics.push(metric);
      }
    });

    // Get all timestamps (use the first metric's timestamps as reference)
    const firstMetric = selectedMetrics[0];
    if (!firstMetric) {
      alert('No selected metrics have data.');
      return;
    }

    const dataPoints = recordedDataRef.current.get(firstMetric) || [];
    const rows = [headers.join(',')];

    // Build CSV rows
    dataPoints.forEach((point) => {
      const row = [point.x.toFixed(3)]; // Timestamp in seconds with 3 decimal places
      
      selectedMetrics.forEach(metric => {
        const metricData = recordedDataRef.current!.get(metric) || [];
        // Find data point at this timestamp
        const dataPoint = metricData.find(d => Math.abs(d.x - point.x) < 0.001);
        row.push(dataPoint ? dataPoint.y.toFixed(3) : '');
      });
      
      rows.push(row.join(','));
    });

    // Create and download file
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleExportSelection = (metric: MetricType) => {
    const newSelections = new Set(exportSelections);
    if (newSelections.has(metric)) {
      newSelections.delete(metric);
    } else {
      newSelections.add(metric);
    }
    setExportSelections(newSelections);
  };

  // Calculate which metrics are used across all plots
  const usedMetricsInAllPlots = new Set<MetricType>();
  plots.forEach(plot => {
    if (plot.leftYAxis) usedMetricsInAllPlots.add(plot.leftYAxis);
    if (plot.rightYAxis) usedMetricsInAllPlots.add(plot.rightYAxis);
  });

  const totalCutoffVoltage = escConfig.batteryCells * (escConfig.batteryCutoff / 1000);
  const totalWarningVoltage = escConfig.batteryCells * ((escConfig.batteryCutoff + escConfig.batteryWarningDelta) / 1000);

  return (
    <div className="container">
      <div className="header">
        <h1>RC Power Meter</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {connected && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>{deviceName}</span>
              <button 
                className="button-secondary" 
                onClick={handleRenameDevice}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                title="Rename device"
              >
                ✏️
              </button>
            </div>
          )}
          {!connected ? (
            <button className="button-primary" onClick={handleConnect}>
              Connect Device
            </button>
          ) : (
            <button className="button-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          )}
        </div>
      </div>

      <StatusBar 
        connected={connected}
        recording={recording}
        sampleCount={sampleCount}
      />

      {connected && (
        <>
          <ESCControl
            config={escConfig}
            onConfigChange={handleConfigChange}
            dshotSettings={dshotSettings}
            onDshotSettingsChange={handleDshotSettingsChange}
            running={escRunning}
            escConnected={escConnected}
            onConnectESC={handleConnectESC}
            onDisconnectESC={handleDisconnectESC}
            cutoffVoltage={totalCutoffVoltage}
            warningVoltage={totalWarningVoltage}
          />

          {escConfig.mode === ESCMode.DSHOT && (
            <DSHOTCommands
              onSendCommand={handleSendDSHOTCommand}
              escInfo={escInfo}
              escConnected={escConnected}
            />
          )}

          <MotorControl
            escType={escConfig.escType}
            throttle={throttle}
            onThrottleChange={handleThrottleChange}
            running={escRunning && batteryStatus?.state !== BatteryState.CUTOFF}
            onStart={handleStart}
            onStop={handleStop}
            disabled={!escConnected || (escConfig.batteryProtectionEnabled && batteryStatus?.state === BatteryState.CUTOFF)}
            batteryStatus={batteryStatus}
            batteryProtectionEnabled={escConfig.batteryProtectionEnabled}
            cutoffVoltage={totalCutoffVoltage}
          />

          <DynamicDataCards 
            data={latestData} 
            mode={escConfig.mode}
            cards={dataCards}
            onAddCard={handleAddCard}
            onRemoveCard={handleRemoveCard}
            onChangeMetric={handleChangeMetric}
            dshotSettings={dshotSettings}
          />

          {plots.map((plot, index) => {
            return (
              <PlotPanel
                key={plot.id}
                plot={plot}
                data={latestData}
                mode={escConfig.mode}
                recording={recording}
                startTime={recordingStartTime}
                onRemove={() => handleRemovePlot(plot.id)}
                onUpdateLeftAxis={(metric) => handleUpdatePlotLeftAxis(plot.id, metric)}
                onUpdateRightAxis={(metric) => handleUpdatePlotRightAxis(plot.id, metric)}
                onDataRef={index === 0 ? (ref) => { recordedDataRef.current = ref.current; } : undefined}
                onSampleCountUpdate={index === 0 ? (count) => setSampleCount(count) : undefined}
                dshotSettings={dshotSettings}
              />
            );
          })}

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              className="button-secondary"
              onClick={handleAddPlot}
              disabled={recording}
              style={{ 
                padding: '0.75rem 2rem',
                cursor: recording ? 'not-allowed' : 'pointer',
                opacity: recording ? 0.5 : 1
              }}
              title={recording ? "Cannot add plots while recording" : ""}
            >
              + Add Plot
            </button>
          </div>

          <div className="panel" style={{ marginTop: '1rem' }}>
            <h3 className="panel-title">Data Recording</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              {!recording ? (
                <button
                  className="button-primary"
                  onClick={handleStartRecording}
                  style={{ padding: '0.75rem 2rem' }}
                >
                  ● Start Recording
                </button>
              ) : (
                <>
                  <button
                    className="button-danger"
                    onClick={handleStopRecording}
                    style={{ padding: '0.75rem 2rem' }}
                  >
                    ■ Stop Recording
                  </button>
                  <div style={{ color: '#10b981', fontSize: '1rem' }}>
                    ● Recording: {sampleCount.toLocaleString()} samples
                  </div>
                </>
              )}
            </div>

            {recordedDataRef.current && recordedDataRef.current.size > 0 && (
              <>
                <div style={{ borderTop: '1px solid #333', margin: '1rem 0' }} />
                <div style={{ 
                  padding: '0 1rem 1rem',
                  opacity: recording ? 0.5 : 1,
                  pointerEvents: recording ? 'none' : 'auto'
                }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#ddd' }}>
                    Data Export
                  </h4>
                  <p style={{ marginBottom: '1rem', color: '#aaa', fontSize: '0.875rem' }}>
                    Select metrics to export:
                  </p>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    {Object.values(MetricType).map(metric => {
                      const hasData = recordedDataRef.current?.has(metric);
                      if (!hasData) return null;
                      
                      // Get dynamic unit for tip speed
                      let unit = METRIC_UNITS[metric];
                      if (metric === MetricType.TIP_SPEED && dshotSettings) {
                        const unitMap: Record<TipSpeedUnit, string> = {
                          [TipSpeedUnit.MPH]: 'mph',
                          [TipSpeedUnit.MS]: 'm/s',
                          [TipSpeedUnit.KMH]: 'km/h',
                          [TipSpeedUnit.FTS]: 'ft/s'
                        };
                        unit = unitMap[dshotSettings.tipSpeedUnit];
                      }
                      
                      return (
                        <label 
                          key={metric}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            backgroundColor: exportSelections.has(metric) ? '#2a2a2a' : 'transparent',
                            border: '1px solid #444'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={exportSelections.has(metric)}
                            onChange={() => toggleExportSelection(metric)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>
                            {METRIC_LABELS[metric]} ({unit})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
                    <button
                      className="button-primary"
                      onClick={handleExportCSV}
                      disabled={exportSelections.size === 0}
                      style={{ 
                        padding: '0.75rem 2rem',
                        cursor: exportSelections.size === 0 ? 'not-allowed' : 'pointer',
                        opacity: exportSelections.size === 0 ? 0.5 : 1
                      }}
                    >
                      📥 Export to CSV
                    </button>
                    <span style={{ color: '#888', fontSize: '0.875rem' }}>
                      {sampleCount.toLocaleString()} samples recorded
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {!connected && (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Welcome to RC Power Meter</h2>
          <p style={{ marginTop: '1rem', color: '#aaa' }}>
            Click "Connect Device" to get started
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>
            Note: Web Bluetooth requires Chrome, Edge, or Opera browser
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
