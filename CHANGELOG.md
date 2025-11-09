# Changelog - DSHOT Special Commands Feature

## November 8, 2025 - DSHOT Special Commands Implementation

### ✅ Web App Changes

#### New Features
1. **DSHOT Commands Panel** - Control ESC settings and read information
   - ESC Information reading (firmware, direction, 3D mode)
   - Motor direction control (normal/reverse)
   - 3D mode toggle (bidirectional operation)
   - Beeper commands (5 patterns)
   - LED control (4 LEDs on/off)
   - Save settings to ESC EEPROM

2. **Unit Conversion Utilities** - Accurate calculations for spinner metrics
   - Tip speed calculation with multiple unit support
   - Kinetic energy calculation
   - Diameter units: inches, mm, cm
   - MOI units: kg·mm², kg·cm², kg·m², g·cm²
   - Speed units: mph, m/s, km/h, ft/s

3. **Enhanced ESC Configuration** - Display settings for calculated metrics
   - Diameter input with unit selector
   - Moment of inertia input with unit selector
   - Tip speed display unit selector
   - All settings persisted per device

#### Bug Fixes
- **BLE Connection Issue**: Made DSHOT characteristics optional for backward compatibility
  - Web app now works with both old and new firmware versions
  - Gracefully degrades when DSHOT commands not supported
  - Logs "DSHOT commands not supported" instead of failing connection

#### Technical Changes
- Added `BLE_CHAR_DSHOT_COMMAND_UUID` and `BLE_CHAR_DSHOT_RESPONSE_UUID` characteristics
- Implemented `sendDSHOTCommand()` method in BLEManager
- Added DSHOT response callback handling
- Extended DeviceStorage to persist DSHOT display settings
- Created DSHOTCommands component (171 lines)
- Created unitConversions utility (105 lines)

### ✅ Firmware Changes

#### New BLE Characteristics
- **DSHOT Command** (UUID: ...def5) - Write-only, receives 1-byte commands
- **DSHOT Response** (UUID: ...def6) - Notify, sends variable-length responses

#### New Functionality
1. **DSHOT Command Handler** in main.cpp
   - Beep commands (1-5): 6 repetitions
   - ESC info (6): Returns firmware/direction/3D mode status
   - Direction control (7,8,20,21): 6 repetitions
   - 3D mode (9,10): 10 repetitions
   - Save settings (12): 10 repetitions
   - LED control (22-29): 6 repetitions

2. **BLEManager Extensions**
   - `sendDSHOTResponse()` method for sending responses
   - `onDSHOTCommandWrite()` callback for receiving commands
   - `hasNewDSHOTCommand()` and `clearDSHOTCommandFlag()` methods
   - DSHOT command state tracking

3. **Response Packet Format**
   - Type 0 (ack): Simple acknowledgment
   - Type 1 (info): ESC information (firmware, direction, 3D mode)
   - Type 2 (settings): Settings data (reserved for future use)

### 📋 Testing Status

#### Web App ✅
- [x] TypeScript compilation - No errors
- [x] BLE connection backward compatibility
- [x] DSHOT commands panel UI complete
- [x] Unit conversions implemented

#### Firmware ✅
- [x] Compilation successful
- [x] Upload successful
- [x] BLE characteristics created
- [x] Command handler implemented
- [x] Response sending implemented

#### Integration Testing 🔄
- [ ] Browser connection test
- [ ] DSHOT commands panel appears in DSHOT mode
- [ ] Beep commands work
- [ ] ESC info reading works
- [ ] Direction control (test at low throttle)
- [ ] LED control (if ESC supports)
- [ ] Settings save and persistence

### 🔧 Known Issues
- ESC info response returns placeholder values (firmware version, direction, 3D mode not tracked yet)
- Direction and 3D mode state not persisted in firmware (always returns 0)

### 📚 Documentation
- `DSHOT_COMMANDS.md` - Complete feature documentation
- `FIRMWARE_TODO_DSHOT.md` - Implementation guide (now complete)
- `IMPLEMENTATION_SUMMARY.md` - Architecture overview

### 🚀 Next Steps
1. Test DSHOT commands end-to-end
2. Add state tracking for direction and 3D mode
3. Extract firmware version from ESC telemetry if available
4. Add calculated metrics (tip speed, kinetic energy) to data display

### ⚠️ Safety Notes
- Always test direction changes at low throttle first
- 3D mode requires compatible ESC firmware
- Save settings makes permanent changes to ESC
- Remove propeller for initial testing

### 📐 Formulas (Verified)
```
Tip Speed (m/s) = π × Diameter(m) × RPM / 60
Kinetic Energy (J) = 0.5 × MOI(kg·m²) × ω² where ω = 2π × RPM / 60
```

### 🔗 References
- DSHOT Protocol: BLHeli_32 Digital Command Specification
- ESC Commands: Values 1-47 reserved for special commands
- Command Repetition: 6-10 times for reliability
