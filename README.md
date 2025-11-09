# RC Power Meter Web App

A web-based interface for the Smart RC Power Meter running on Raspberry Pi Pico W. Built with React, TypeScript, and Vite, using Web Bluetooth API for wireless communication.

## Features

- **BLE Connection**: Connect wirelessly to Pico W power meter
- **Real-time Data Display**: Live voltage, current, power, and throttle readings at up to 200 Hz
- **ESC Control**: 
  - PWM or DSHOT mode selection
  - Unidirectional or bidirectional throttle control
  - Adjustable throttle range and ramp limiting
  - Percentage-based throttle input (0-100% or -100% to +100%)
- **Battery Protection**: Configurable cell count, cutoff voltage, and warning thresholds
- **DSHOT Telemetry**: RPM, temperature, ESC voltage/current (when in DSHOT mode)
- **Live Data Cards**: Customizable metric displays
- **Data Logging & Export**: Record sessions and export to CSV (Phase 5 - coming soon)
- **Multi-Device Support**: Connect to multiple power meters simultaneously (Phase 6 - coming soon)

## Browser Compatibility

**Web Bluetooth API is required** and is only supported in:
- Chrome/Chromium (desktop and Android)
- Edge (desktop and Android)
- Opera (desktop and Android)

**NOT supported in:**
- Firefox
- Safari
- iOS browsers

## Development

### Prerequisites

- Node.js 18+ and npm
- A Chromium-based browser (Chrome, Edge, or Opera)

### Installation

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Local Development

The dev server runs at `http://localhost:3000/Power-Meter-Web-App/`

**Note:** Web Bluetooth requires either:
- HTTPS connection, OR
- `localhost` (works in development)

## Usage

1. **Connect**: Click "Connect Device" and select your Pico W from the browser's Bluetooth pairing dialog
2. **Configure**: Set ESC mode (PWM/DSHOT), type (uni/bidirectional), battery protection, and other settings
3. **Control**: Adjust throttle slider (disabled until START is pressed)
4. **Start**: Click the green START button to send configuration and begin ESC operation
5. **Monitor**: View real-time data in the live data cards
6. **Stop**: Click the red STOP button to safely stop the ESC

## Safety Features

- **Battery protection**: Automatic ESC cutoff when voltage drops below threshold
- **Warning system**: Yellow warning banner when approaching cutoff voltage
- **Ramp limiting**: Gradual throttle changes prevent sudden motor starts
- **START/STOP safety**: All settings locked while ESC is running
- **Deadband**: 0-0.5% throttle = motor stop (prevents accidental starts)

## Implementation Status

- ✅ **Phase 1**: Core infrastructure (BLE connection, live data)
- ✅ **Phase 2**: ESC control (throttle, battery protection, START/STOP)
- ✅ **Phase 3**: DSHOT telemetry display
- ✅ **Phase 4**: Basic data cards
- ⏳ **Phase 5**: Data logging and CSV export
- ⏳ **Phase 6**: Multi-device support
- ⏳ **Phase 7**: Responsive design polish

## BLE Protocol Documentation

See the full BLE protocol specification in `IMPLEMENTATION_PLAN.md` in the firmware repository.

## License

See LICENSE file in the repository root.
