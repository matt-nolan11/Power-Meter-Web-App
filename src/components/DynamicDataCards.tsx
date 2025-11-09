import React from 'react';
import { PWMDataPacket, DSHOTDataPacket, ESCMode, DSHOTDisplaySettings } from '../types/ble';
import { DataCard, MetricType, METRIC_LABELS, METRIC_UNITS, DSHOT_ONLY_METRICS } from '../types/dashboard';
import { getMetricValue, formatMetricValue } from '../utils/metricUtils';
import { TipSpeedUnit } from '../types/ble';

interface DynamicDataCardsProps {
  data: PWMDataPacket | DSHOTDataPacket | null;
  mode: ESCMode;
  cards: DataCard[];
  onAddCard: () => void;
  onRemoveCard: (id: string) => void;
  onChangeMetric: (id: string, metric: MetricType) => void;
  dshotSettings?: DSHOTDisplaySettings;
}

const DynamicDataCards: React.FC<DynamicDataCardsProps> = ({
  data,
  mode,
  cards,
  onAddCard,
  onRemoveCard,
  onChangeMetric,
  dshotSettings
}) => {
  const isDSHOT = mode === ESCMode.DSHOT;

  // Get available metrics based on mode
  const availableMetrics = Object.values(MetricType).filter(metric => {
    if (DSHOT_ONLY_METRICS.includes(metric)) {
      return isDSHOT;
    }
    return true;
  });

  // Get used metrics
  const usedMetrics = new Set(cards.map(card => card.metric));

  // Get metrics available for new cards (unused)
  const unusedMetrics = availableMetrics.filter(metric => !usedMetrics.has(metric));

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Live Data</h3>
        <button 
          className="button-secondary"
          onClick={onAddCard}
          disabled={unusedMetrics.length === 0}
          style={{ 
            padding: '0.5rem 1rem', 
            fontSize: '0.875rem',
            opacity: unusedMetrics.length === 0 ? 0.5 : 1,
            cursor: unusedMetrics.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          + Add Card
        </button>
      </div>
      
      {cards.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
          Click "+ Add Card" to display live data
        </p>
      ) : (
        <div className="data-cards">
          {cards.map(card => {
            const value = getMetricValue(data, card.metric, dshotSettings);
            const formattedValue = formatMetricValue(value, card.metric);
            
            // Get unit - for tip speed, use the dynamic unit from settings
            let unit = METRIC_UNITS[card.metric];
            if (card.metric === MetricType.TIP_SPEED && dshotSettings) {
              const unitMap: Record<TipSpeedUnit, string> = {
                [TipSpeedUnit.MPH]: 'mph',
                [TipSpeedUnit.MS]: 'm/s',
                [TipSpeedUnit.KMH]: 'km/h',
                [TipSpeedUnit.FTS]: 'ft/s'
              };
              unit = unitMap[dshotSettings.tipSpeedUnit];
            }
            
            // For each card, show available options (current metric + unused metrics)
            const availableForThisCard = [card.metric, ...unusedMetrics];

            return (
              <div key={card.id} className="data-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <select
                    className="form-input"
                    value={card.metric}
                    onChange={(e) => onChangeMetric(card.id, e.target.value as MetricType)}
                    style={{ fontSize: '0.875rem', padding: '0.25rem', flex: 1, marginRight: '0.5rem' }}
                  >
                    {availableForThisCard.map(metric => (
                      <option key={metric} value={metric}>
                        {METRIC_LABELS[metric]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemoveCard(card.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      padding: '0',
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="data-card-value">
                  {formattedValue} {unit}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DynamicDataCards;
