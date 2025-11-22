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
  TipSpeedUnit
} from './types/ble';
import { DataCard, PlotConfig, MetricType, METRIC_LABELS, METRIC_UNITS } from './types/dashboard';
import ESCControl from './components/ESCControl.tsx';
import MotorControl from './components/MotorControl.tsx';
import StatusBar from './components/StatusBar.tsx';
import DynamicDataCards from './components/DynamicDataCards.tsx';
import PlotPanel from './components/PlotPanel.tsx';

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
  
  // Track which metrics have been initialized for export
  const initializedMetricsRef = useRef<Set<MetricType>>(new Set());
  
  // CSV export selections - start with empty set, user selects what they want
  const [exportSelections, setExportSelections] = useState<Set<MetricType>>(
    new Set()
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
    gearRatio: 1.0,
    tipSpeedUnit: TipSpeedUnit.MPH
  });

  const [throttle, setThrottle] = useState(0);
  const [escRunning, setEscRunning] = useState(false);
  const [escConnected, setEscConnected] = useState(false);
  const throttleTimeoutRef = useRef<number | null>(null);
  const lastThrottleSendRef = useRef<number>(0);
  const recordingRef = useRef(false);
  const escRunningRef = useRef(false);
  const lastBatteryStateRef = useRef<BatteryState>(BatteryState.NORMAL);
  
  // Column resize state
  const [leftColumnWidth, setLeftColumnWidth] = useState(650);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(650);

  // Keep refs in sync with state
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    escRunningRef.current = escRunning;
  }, [escRunning]);

  // Auto-select all metrics when they first appear
  useEffect(() => {
    if (recordedDataRef.current && recordedDataRef.current.size > 0) {
      const newMetrics = new Set(exportSelections);
      let hasNewMetrics = false;
      
      recordedDataRef.current.forEach((_, metric) => {
        if (!initializedMetricsRef.current.has(metric)) {
          initializedMetricsRef.current.add(metric);
          newMetrics.add(metric);
          hasNewMetrics = true;
        }
      });
      
      if (hasNewMetrics) {
        setExportSelections(newMetrics);
      }
    }
  }, [recordedDataRef.current?.size, exportSelections]);

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
      
      // Reset runtime states on connection - ensure clean state
      // (device firmware will also reset on BLE connect)
      setEscRunning(false);
      setEscConnected(false);
      setRecording(false);
    } catch (error) {
      console.error('Failed to connect:', error);
      // Only show error if it's not a user cancellation
      if (error instanceof Error && !error.message.includes('User cancelled')) {
        alert('Failed to connect to device. Make sure Bluetooth is enabled and the device is nearby.');
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      // Stop recording first if active
      if (recording) {
        setRecording(false);
      }
      
      // Stop ESC motor if running
      if (escRunning) {
        try {
          const stopCommand: ESCCommandPacket = {
            command: 0, // STOP
            throttle: 0
          };
          await bleManager.sendCommand(stopCommand);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
          console.warn('Failed to stop ESC during disconnect:', e);
        }
      }
      
      // Disconnect ESC if connected
      if (escConnected) {
        try {
          const disconnectCommand: ESCCommandPacket = {
            command: 3, // DISCONNECT
            throttle: 0
          };
          await bleManager.sendCommand(disconnectCommand);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
          console.warn('Failed to disconnect ESC during BLE disconnect:', e);
        }
      }
      
      // Finally disconnect BLE
      await bleManager.disconnect();
      
      // Delay to ensure firmware processes disconnect
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setConnected(false);
      setEscRunning(false);
      setEscConnected(false);
      setRecording(false);
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still update UI even if disconnect had issues
      setConnected(false);
      setEscRunning(false);
      setEscConnected(false);
      setRecording(false);
    }
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
    
    // If ESC is running, send throttle updates immediately during slider interaction
    // with minimal rate limiting (20ms) to prevent BLE queue overflow
    if (escRunning && connected) {
      const now = Date.now();
      const timeSinceLastSend = now - lastThrottleSendRef.current;
      
      // Clear any pending throttle update
      if (throttleTimeoutRef.current !== null) {
        clearTimeout(throttleTimeoutRef.current);
      }
      
      // If enough time has passed since last send, send immediately
      if (timeSinceLastSend >= 20) {
        lastThrottleSendRef.current = now;
        const command: ESCCommandPacket = {
          command: 1, // START (keeps it running with new throttle)
          throttle: newThrottle
        };
        bleManager.sendCommand(command).catch(error => {
          console.error('Failed to update throttle:', error);
        });
      } else {
        // Otherwise schedule for next available slot
        const delay = 20 - timeSinceLastSend;
        throttleTimeoutRef.current = window.setTimeout(async () => {
          try {
            lastThrottleSendRef.current = Date.now();
            const command: ESCCommandPacket = {
              command: 1, // START (keeps it running with new throttle)
              throttle: newThrottle
            };
            await bleManager.sendCommand(command);
            throttleTimeoutRef.current = null;
          } catch (error) {
            console.error('Failed to update throttle:', error);
          }
        }, delay);
      }
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
      if ([MetricType.MOTOR_RPM, MetricType.OUTPUT_RPM, MetricType.ESC_VOLTAGE, MetricType.ESC_CURRENT, 
           MetricType.ESC_TEMP, MetricType.ESC_STATUS, MetricType.ESC_STRESS, 
           MetricType.TIP_SPEED, MetricType.KINETIC_ENERGY].includes(metric)) {
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

  const selectAllMetrics = () => {
    if (!recordedDataRef.current) return;
    const allMetrics = new Set<MetricType>();
    recordedDataRef.current.forEach((_, metric) => {
      allMetrics.add(metric);
    });
    setExportSelections(allMetrics);
  };

  const deselectAllMetrics = () => {
    setExportSelections(new Set());
  };

  const selectPlottedMetrics = () => {
    if (!recordedDataRef.current) return;
    const plottedMetrics = new Set<MetricType>();
    plots.forEach(plot => {
      if (plot.leftYAxis && recordedDataRef.current!.has(plot.leftYAxis)) {
        plottedMetrics.add(plot.leftYAxis);
      }
      if (plot.rightYAxis && recordedDataRef.current!.has(plot.rightYAxis)) {
        plottedMetrics.add(plot.rightYAxis);
      }
    });
    setExportSelections(plottedMetrics);
  };

  // Calculate which metrics are used across all plots
  const usedMetricsInAllPlots = new Set<MetricType>();
  plots.forEach(plot => {
    if (plot.leftYAxis) usedMetricsInAllPlots.add(plot.leftYAxis);
    if (plot.rightYAxis) usedMetricsInAllPlots.add(plot.rightYAxis);
  });

  const totalCutoffVoltage = escConfig.batteryCells * (escConfig.batteryCutoff / 1000);
  const totalWarningVoltage = escConfig.batteryCells * ((escConfig.batteryCutoff + escConfig.batteryWarningDelta) / 1000);

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = leftColumnWidth;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(300, Math.min(800, resizeStartWidth.current + delta));
      setLeftColumnWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="container" style={{ '--left-column-width': `${leftColumnWidth}px` } as React.CSSProperties}>
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
          {/* Desktop Layout: 2-column grid for better space usage */}
          <div className="desktop-layout">
            {/* Resize Handle */}
            <div 
              className={`column-resize-handle ${isResizing ? 'resizing' : ''}`}
              onMouseDown={handleResizeStart}
              style={{ left: `${leftColumnWidth}px` }}
            />
            
            {/* Left Column: Controls */}
            <div className="controls-column">
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
            </div>

            {/* Right Column: Live Data & Plots */}
            <div className="data-column">
              {/* Live Data Cards */}
              <DynamicDataCards 
                data={latestData} 
                mode={escConfig.mode}
                cards={dataCards}
                onAddCard={handleAddCard}
                onRemoveCard={handleRemoveCard}
                onChangeMetric={handleChangeMetric}
                dshotSettings={dshotSettings}
              />

              {/* Plots Grid */}
              <div className="plots-grid">
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
              </div>

              <div style={{ marginTop: '0.25rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                <button
                  className="button-secondary"
                  onClick={handleAddPlot}
                  disabled={recording}
                  style={{ 
                    padding: '0.35rem 1rem',
                    fontSize: '0.8rem',
                    cursor: recording ? 'not-allowed' : 'pointer',
                    opacity: recording ? 0.5 : 1
                  }}
                  title={recording ? "Cannot add plots while recording" : ""}
                >
                  + Add Plot
                </button>
              </div>

              {/* Data Recording Controls */}
              <div className="panel">
                <h3 className="panel-title">Data Recording</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                  {!recording ? (
                    <button
                      className="button-primary"
                      onClick={handleStartRecording}
                      style={{ padding: '0.5rem 1.25rem' }}
                    >
                      ● Start Recording
                    </button>
                  ) : (
                    <>
                      <button
                        className="button-danger"
                        onClick={handleStopRecording}
                        style={{ padding: '0.5rem 1.25rem' }}
                      >
                        ■ Stop Recording
                      </button>
                      <div style={{ color: '#10b981', fontSize: '0.85rem' }}>
                        ● Recording: {sampleCount.toLocaleString()} samples
                      </div>
                    </>
                  )}
                </div>

                {/* Data Export Section */}
                {recordedDataRef.current && recordedDataRef.current.size > 0 && (
                  <>
                    <div style={{ borderTop: '1px solid #333', margin: '0.5rem 0' }} />
                    <div style={{ 
                      padding: '0 0.5rem 0.5rem',
                      opacity: recording ? 0.5 : 1,
                      pointerEvents: recording ? 'none' : 'auto'
                    }}>
                      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#ddd' }}>
                        Data Export
                      </h4>
                      <p style={{ marginBottom: '0.5rem', color: '#aaa', fontSize: '0.75rem' }}>
                        Select metrics to export:
                      </p>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
                        gap: '0.4rem',
                        marginBottom: '0.5rem',
                        justifyItems: 'center'
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
                          
                          const isChecked = exportSelections.has(metric);
                          
                          return (
                            <label 
                              key={metric}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                cursor: 'pointer',
                                padding: '0.35rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: isChecked ? '#2a2a2a' : 'transparent',
                                border: '1px solid #444',
                                width: '100%',
                                maxWidth: '200px'
                              }}
                            >
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleExportSelection(metric)}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.75rem' }}>
                                {METRIC_LABELS[metric]} ({unit})
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          className="button-primary"
                          onClick={handleExportCSV}
                          disabled={exportSelections.size === 0}
                          style={{ 
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            cursor: exportSelections.size === 0 ? 'not-allowed' : 'pointer',
                            opacity: exportSelections.size === 0 ? 0.5 : 1
                          }}
                        >
                          💾 Export CSV ({exportSelections.size})
                        </button>
                        <button
                          className="button-secondary"
                          onClick={selectAllMetrics}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Select All
                        </button>
                        <button
                          className="button-secondary"
                          onClick={deselectAllMetrics}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Deselect All
                        </button>
                        <button
                          className="button-secondary"
                          onClick={selectPlottedMetrics}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Plotted Only
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
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
