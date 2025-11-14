import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { PWMDataPacket, DSHOTDataPacket, ESCMode, DSHOTDisplaySettings, TipSpeedUnit } from '../types/ble';
import { PlotConfig, MetricType, METRIC_LABELS, METRIC_UNITS, DSHOT_ONLY_METRICS } from '../types/dashboard';
import { getMetricValue } from '../utils/metricUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

/**
 * Get the display unit for a metric, handling dynamic units like tip speed
 */
function getMetricUnit(metric: MetricType, dshotSettings?: DSHOTDisplaySettings): string {
  if (metric === MetricType.TIP_SPEED && dshotSettings) {
    const unitMap: Record<TipSpeedUnit, string> = {
      [TipSpeedUnit.MPH]: 'mph',
      [TipSpeedUnit.MS]: 'm/s',
      [TipSpeedUnit.KMH]: 'km/h',
      [TipSpeedUnit.FTS]: 'ft/s'
    };
    return unitMap[dshotSettings.tipSpeedUnit];
  }
  return METRIC_UNITS[metric];
}

interface PlotPanelProps {
  plot: PlotConfig;
  data: PWMDataPacket | DSHOTDataPacket | null;
  mode: ESCMode;
  recording: boolean; // Only plot when recording
  startTime: number; // Recording start time for relative timestamps
  onRemove: () => void;
  onUpdateLeftAxis: (metric: MetricType | null) => void;
  onUpdateRightAxis: (metric: MetricType | null) => void;
  onDataRef?: (dataRef: React.MutableRefObject<Map<MetricType, { x: number; y: number }[]>>) => void;
  onSampleCountUpdate?: (count: number) => void;
  dshotSettings?: DSHOTDisplaySettings;
}

const PlotPanel: React.FC<PlotPanelProps> = ({
  plot,
  data,
  mode,
  recording,
  startTime,
  onRemove,
  onUpdateLeftAxis,
  onUpdateRightAxis,
  onDataRef,
  onSampleCountUpdate,
  dshotSettings
}) => {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const isDSHOT = mode === ESCMode.DSHOT;
  
  // Use state for datasets so React knows to re-render
  const [chartDatasets, setChartDatasets] = useState<any[]>([]);
  const [timeWindowWidth, setTimeWindowWidth] = useState(10); // Default 10 seconds
  const [xAxisRange, setXAxisRange] = useState({ min: 0, max: 10 });
  const [yAxisRanges, setYAxisRanges] = useState({ 
    y: { min: 0, max: 20 }, 
    y1: { min: 0, max: 20 } 
  });
  
  // Store ALL metric data during recording, not just displayed ones
  const allMetricDataRef = useRef<Map<MetricType, { x: number; y: number }[]>>(new Map());
  
  const updateCountRef = useRef(0);
  const prevRecordingRef = useRef(false); // Always start with false
  const hasResetForCurrentRecording = useRef(false); // Track if we've reset for this recording session
  const recordingRef = useRef(false); // Local ref synced with recording prop

  // Sync recording ref immediately when prop changes
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  // Pass data reference to parent on mount
  useEffect(() => {
    if (onDataRef) {
      onDataRef(allMetricDataRef);
    }
  }, [onDataRef]);

  // Reset datasets when recording starts
  useEffect(() => {
    const recordingJustStarted = recording && !prevRecordingRef.current;
    const recordingJustStopped = !recording && prevRecordingRef.current;
    
    if (recordingJustStarted) {
      // Recording just started - clear ALL data
      allMetricDataRef.current.clear();
      
      const newDatasets = [];
      
      if (plot.leftYAxis) {
        newDatasets.push({
          label: METRIC_LABELS[plot.leftYAxis],
          metric: plot.leftYAxis,
          data: [] as { x: number; y: number }[],
          borderColor: `hsl(0, 70%, 50%)`,
          backgroundColor: `hsla(0, 70%, 50%, 0.1)`,
          borderWidth: 2,
          yAxisID: 'y',
          tension: 0.4,
          pointRadius: 0,
          showLine: true,
          fill: false
        });
      }
      
      if (plot.rightYAxis) {
        newDatasets.push({
          label: METRIC_LABELS[plot.rightYAxis],
          metric: plot.rightYAxis,
          data: [] as { x: number; y: number }[],
          borderColor: `hsl(120, 70%, 50%)`,
          backgroundColor: `hsla(120, 70%, 50%, 0.1)`,
          borderWidth: 2,
          yAxisID: 'y1',
          tension: 0.4,
          pointRadius: 0,
          showLine: true,
          fill: false
        });
      }
      
      setChartDatasets(newDatasets);
      setXAxisRange({ min: 0, max: timeWindowWidth });
      setYAxisRanges({ y: { min: 0, max: 20 }, y1: { min: 0, max: 20 } });
      updateCountRef.current = 0;
      hasResetForCurrentRecording.current = true;
      
      console.log('Recording started - datasets cleared');
    }
    
    // When recording stops, reset the update counter and the reset flag
    if (recordingJustStopped) {
      updateCountRef.current = 0;
      hasResetForCurrentRecording.current = false;
      console.log('Recording stopped - counter reset');
    }

    prevRecordingRef.current = recording;
  }, [recording]);

  // Update datasets when axes change (while NOT recording)
  useEffect(() => {
    if (!recording) {
      // Use stored metric data to populate new axes
      const newDatasets = [];
      
      if (plot.leftYAxis) {
        newDatasets.push({
          label: METRIC_LABELS[plot.leftYAxis],
          metric: plot.leftYAxis,
          data: allMetricDataRef.current.get(plot.leftYAxis) || [],
          borderColor: `hsl(0, 70%, 50%)`,
          backgroundColor: `hsla(0, 70%, 50%, 0.1)`,
          borderWidth: 2,
          yAxisID: 'y',
          tension: 0.4,
          pointRadius: 0,
          showLine: true,
          fill: false
        });
      }
      
      if (plot.rightYAxis) {
        newDatasets.push({
          label: METRIC_LABELS[plot.rightYAxis],
          metric: plot.rightYAxis,
          data: allMetricDataRef.current.get(plot.rightYAxis) || [],
          borderColor: `hsl(120, 70%, 50%)`,
          backgroundColor: `hsla(120, 70%, 50%, 0.1)`,
          borderWidth: 2,
          yAxisID: 'y1',
          tension: 0.4,
          pointRadius: 0,
          showLine: true,
          fill: false
        });
      }
      
      setChartDatasets(newDatasets);
    }
  }, [plot.leftYAxis, plot.rightYAxis, recording]);

  // Add data points when recording
  useEffect(() => {
    if (!data || !recordingRef.current) return;

    const relativeTime = (Date.now() - startTime) / 1000;
    
    // Record data for ALL metrics, not just displayed ones
    Object.values(MetricType).forEach(metric => {
      // Skip DSHOT-only metrics if in PWM mode
      if (DSHOT_ONLY_METRICS.includes(metric) && !isDSHOT) {
        return;
      }
      
      const value = getMetricValue(data, metric, dshotSettings);
      if (value !== null) {
        const currentData = allMetricDataRef.current.get(metric) || [];
        const newData = [...currentData, { x: relativeTime, y: value }];
        // Store ALL data - don't filter during recording
        // The chart will show scrolling window during recording via x-axis range
        // After recording, all data will be visible for zooming/panning
        allMetricDataRef.current.set(metric, newData);
      }
    });
    
    // Update sample count based on actual stored data
    // Use the first available metric's data length as the canonical count
    if (onSampleCountUpdate && allMetricDataRef.current.size > 0) {
      const firstMetricData = allMetricDataRef.current.values().next().value;
      if (firstMetricData) {
        onSampleCountUpdate(firstMetricData.length);
      }
    }
    
    // Update displayed datasets from stored data
    setChartDatasets(currentDatasets => {
      if (currentDatasets.length === 0) return currentDatasets;
      
      const updatedDatasets = currentDatasets.map(dataset => {
        const metric = dataset.metric as MetricType;
        const storedData = allMetricDataRef.current.get(metric);
        
        if (storedData) {
          return { ...dataset, data: storedData };
        }
        return dataset;
      });
      
      // Update y-axis ranges every 10 updates
      updateCountRef.current++;
      if (updateCountRef.current % 10 === 0) {
        const newRanges = { ...yAxisRanges };
        
        // Left Y-axis
        if (plot.leftYAxis) {
          const leftValues = updatedDatasets
            .filter((ds: any) => ds.yAxisID === 'y')
            .flatMap((ds: any) => ds.data.map((p: any) => p.y));
          
          if (leftValues.length > 0) {
            const dataMin = Math.min(...leftValues);
            const dataMax = Math.max(...leftValues);
            const range = dataMax - dataMin;
            const padding = Math.max(range * 0.2, 1);
            
            newRanges.y = {
              min: Math.max(0, dataMin - padding),
              max: dataMax + padding
            };
          }
        }
        
        // Right Y-axis
        if (plot.rightYAxis) {
          const rightValues = updatedDatasets
            .filter((ds: any) => ds.yAxisID === 'y1')
            .flatMap((ds: any) => ds.data.map((p: any) => p.y));
          
          if (rightValues.length > 0) {
            const dataMin = Math.min(...rightValues);
            const dataMax = Math.max(...rightValues);
            const range = dataMax - dataMin;
            const padding = Math.max(range * 0.2, 1);
            
            newRanges.y1 = {
              min: Math.max(0, dataMin - padding),
              max: dataMax + padding
            };
          }
        }
        
        setYAxisRanges(newRanges);
      }
      
      return updatedDatasets;
    });
    
    // Update x-axis range
    if (relativeTime > timeWindowWidth) {
      setXAxisRange({ min: relativeTime - timeWindowWidth, max: relativeTime });
    } else {
      setXAxisRange({ min: 0, max: timeWindowWidth });
    }
  }, [data, recording, startTime, plot.leftYAxis, plot.rightYAxis, yAxisRanges, isDSHOT, timeWindowWidth]);

  // Base available metrics (filtered by mode)
  const baseAvailableMetrics = Object.values(MetricType).filter(metric => {
    if (DSHOT_ONLY_METRICS.includes(metric)) {
      return isDSHOT;
    }
    return true;
  });

  // Available metrics for left axis (exclude right axis selection)
  const leftAxisMetrics = baseAvailableMetrics.filter(
    metric => metric !== plot.rightYAxis
  );

  // Available metrics for right axis (exclude left axis selection)
  const rightAxisMetrics = baseAvailableMetrics.filter(
    metric => metric !== plot.leftYAxis
  );

  const chartData: ChartData<'line'> = {
    datasets: chartDatasets as any
  };

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        left: 10,
        right: 10,
        top: 5,
        bottom: 5
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2
      },
      point: {
        radius: 0,
        hitRadius: 10,
        hoverRadius: 4
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: (context) => {
            const x = context[0]?.parsed?.x;
            return (x !== undefined && x !== null) ? `Time: ${x.toFixed(2)}s` : '';
          }
        }
      },
      zoom: {
        pan: {
          enabled: !recording, // Only allow pan when not recording
          mode: 'xy'
        },
        zoom: {
          wheel: {
            enabled: !recording // Only allow zoom when not recording
          },
          pinch: {
            enabled: !recording
          },
          mode: 'xy'
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (seconds)',
          color: '#aaa'
        },
        ticks: {
          color: '#888',
          callback: function(value) {
            // Round to 1 decimal place for cleaner display
            return typeof value === 'number' ? value.toFixed(1) + 's' : value + 's';
          },
          autoSkip: true,
          // Scale tick limit based on window width to avoid flickering threshold
          maxTicksLimit: Math.max(5, Math.floor(timeWindowWidth / 2)),
          padding: 5
        },
        grid: {
          color: '#333'
        },
        // Only set explicit range when recording
        ...(recording && {
          min: xAxisRange.min,
          max: xAxisRange.max
        })
      },
      y: {
        type: 'linear',
        display: plot.leftYAxis !== null,
        position: 'left',
        title: {
          display: plot.leftYAxis !== null,
          text: plot.leftYAxis ? `${METRIC_LABELS[plot.leftYAxis]} (${getMetricUnit(plot.leftYAxis, dshotSettings)})` : '',
          color: '#aaa'
        },
        ticks: {
          color: '#888',
          maxTicksLimit: 8
        },
        grid: {
          color: '#333'
        },
        // Only set explicit range when recording
        ...(recording && {
          min: yAxisRanges.y.min,
          max: yAxisRanges.y.max
        })
      },
      y1: {
        type: 'linear',
        display: plot.rightYAxis !== null,
        position: 'right',
        title: {
          display: plot.rightYAxis !== null,
          text: plot.rightYAxis ? `${METRIC_LABELS[plot.rightYAxis]} (${getMetricUnit(plot.rightYAxis, dshotSettings)})` : '',
          color: '#aaa'
        },
        ticks: {
          color: '#888',
          maxTicksLimit: 8
        },
        grid: {
          drawOnChartArea: false,
          color: '#333'
        },
        // Only set explicit range when recording
        ...(recording && {
          min: yAxisRanges.y1.min,
          max: yAxisRanges.y1.max
        })
      }
    }
  }), [recording, xAxisRange, yAxisRanges, plot.leftYAxis, plot.rightYAxis, timeWindowWidth]);

  const handleLeftAxisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newMetric = value === '' ? null : value as MetricType;
    
    // Prevent selecting the same metric as right axis
    if (newMetric && newMetric === plot.rightYAxis) {
      alert('Cannot use the same metric for both Y-axes. Please select a different metric.');
      return;
    }
    
    onUpdateLeftAxis(newMetric);
  };

  const handleRightAxisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newMetric = value === '' ? null : value as MetricType;
    
    // Prevent selecting the same metric as left axis
    if (newMetric && newMetric === plot.leftYAxis) {
      alert('Cannot use the same metric for both Y-axes. Please select a different metric.');
      return;
    }
    
    onUpdateRightAxis(newMetric);
  };

  // Generate dynamic title based on selected axes
  const generateTitle = () => {
    const parts = [];
    if (plot.leftYAxis) {
      parts.push(METRIC_LABELS[plot.leftYAxis]);
    }
    if (plot.rightYAxis) {
      parts.push(METRIC_LABELS[plot.rightYAxis]);
    }
    if (parts.length === 0) {
      return plot.title; // Fallback to original title if no axes selected
    }
    return parts.join(' + ') + ' vs Time';
  };

  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <div className="panel-header">
        <h3 className="panel-title">{generateTitle()}</h3>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: '0 0.5rem'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0 1rem' }}>
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
            Left Y-Axis {recording && <span style={{ color: '#888', fontSize: '0.75rem' }}>(locked while recording)</span>}
          </label>
          <select
            value={plot.leftYAxis || ''}
            onChange={handleLeftAxisChange}
            disabled={recording}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #444',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: recording ? 'not-allowed' : 'pointer',
              opacity: recording ? 0.5 : 1
            }}
          >
            <option value="">-- Select Metric --</option>
            {leftAxisMetrics.map(metric => (
              <option key={metric} value={metric}>
                {METRIC_LABELS[metric]} ({getMetricUnit(metric, dshotSettings)})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
            Right Y-Axis {recording && <span style={{ color: '#888', fontSize: '0.75rem' }}>(locked while recording)</span>}
          </label>
          <select
            value={plot.rightYAxis || ''}
            onChange={handleRightAxisChange}
            disabled={recording}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #444',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: recording ? 'not-allowed' : 'pointer',
              opacity: recording ? 0.5 : 1
            }}
          >
            <option value="">-- Select Metric --</option>
            {rightAxisMetrics.map(metric => (
              <option key={metric} value={metric}>
                {METRIC_LABELS[metric]} ({getMetricUnit(metric, dshotSettings)})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 0.5 }}>
          <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
            Time Window {recording && <span style={{ color: '#888', fontSize: '0.75rem' }}>(locked)</span>}
          </label>
          <select
            value={timeWindowWidth}
            onChange={(e) => setTimeWindowWidth(Number(e.target.value))}
            disabled={recording}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #444',
              backgroundColor: '#2a2a2a',
              color: '#fff',
              fontSize: '0.875rem',
              cursor: recording ? 'not-allowed' : 'pointer',
              opacity: recording ? 0.5 : 1
            }}
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={15}>15s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </div>
      </div>

      <div style={{ height: '300px', padding: '0 1rem 1rem 1rem', overflow: 'hidden' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
};

export default PlotPanel;
