# DSHOT Special Commands Implementation

## Overview
This document describes the DSHOT special commands feature added to the RC Power Meter system. This feature allows the web app to read ESC information and control ESC settings using DSHOT protocol special commands.

## Web App Implementation (✅ Complete)

### New Components

#### 1. **DSHOTCommands.tsx** (171 lines)
A complete UI component providing:
- **ESC Information**: Read firmware version, rotation direction, and 3D mode status
- **Motor Direction Control**: Normal/Reverse buttons with safety warning
- **3D Mode Control**: Enable/Disable bidirectional operation
- **Beeper Commands**: 5 different beep patterns for diagnostics
- **LED Control**: On/Off control for 4 LEDs (if supported by ESC)
- **Save Settings**: Persist settings to ESC EEPROM

#### 2. **unitConversions.ts** (105 lines)
Utilities for accurate calculations:
- `diameterToMeters()`: Convert inches/mm/cm to meters
- `moiToKgM2()`: Convert kg·mm²/kg·cm²/kg·m²/g·cm² to kg·m²
- `calculateTipSpeed()`: π × diameter × RPM / 60 (with unit conversion)
- `calculateKineticEnergy()`: 0.5 × MOI × ω² where ω = 2π × RPM / 60
- `getCalculatedDSHOTMetrics()`: Helper combining all conversions

### Updated Files

#### 3. **ble.ts**
Added type definitions:
```typescript
// New BLE characteristic UUIDs
export const BLE_CHAR_DSHOT_COMMAND_UUID = '12345678-1234-5678-1234-56789abcdef5';
export const BLE_CHAR_DSHOT_RESPONSE_UUID = '12345678-1234-5678-1234-56789abcdef6';

// DSHOT Special Commands enum
export enum DSHOTSpecialCommand {
  BEEP1 = 1, BEEP2 = 2, BEEP3 = 3, BEEP4 = 4, BEEP5 = 5,
  ESC_INFO = 6,
  SPIN_DIRECTION_1 = 7, SPIN_DIRECTION_2 = 8,
  MODE_3D_OFF = 9, MODE_3D_ON = 10,
  SETTINGS_REQUEST = 11, SAVE_SETTINGS = 12,
  SPIN_DIRECTION_NORMAL = 20, SPIN_DIRECTION_REVERSED = 21,
  LED0_ON = 22, LED1_ON = 23, LED2_ON = 24, LED3_ON = 25,
  LED0_OFF = 26, LED1_OFF = 27, LED2_OFF = 28, LED3_OFF = 29
}

// Command packet (write to DSHOT_COMMAND_UUID)
export interface DSHOTCommandPacket {
  command: DSHOTSpecialCommand;  // uint8_t (1 byte)
}

// Response packet (notify from DSHOT_RESPONSE_UUID)
export interface DSHOTResponsePacket {
  type: 'info' | 'settings' | 'ack';
  data?: {
    firmwareVersion?: number;
    rotationDirection?: number;  // 0=normal, 1=reversed
    mode3D?: boolean;
  };
}
```

#### 4. **BLEManager.ts**
Added methods:
- `sendDSHOTCommand(command: DSHOTSpecialCommand)`: Write 1-byte command to characteristic
- `setDSHOTResponseCallback(callback)`: Register callback for ESC responses
- `onDSHOTResponse(event)`: Parse response packets with type indicator

#### 5. **App.tsx**
- Added `escInfo` state to store ESC information
- Added `handleSendDSHOTCommand()` handler
- Set up DSHOT response callback in useEffect
- Rendered `<DSHOTCommands>` component when in DSHOT mode

#### 6. **ESCControl.tsx**
Added DSHOT Configuration section with:
- Motor poles input (sent to firmware for RPM calculation)
- Diameter setting with unit selector (inches/mm/cm)
- Moment of inertia with unit selector (kg·mm²/kg·cm²/kg·m²/g·cm²)
- Tip speed display unit selector (mph/m/s/km/h/ft/s)

## Firmware Implementation (⚠️ Required)

### Step 1: Add BLE Characteristics to `BLEManager.cpp`

```cpp
// In BLEManager.h, add to class definition:
pCharacteristic *pDshotCommandCharacteristic;
pCharacteristic *pDshotResponseCharacteristic;

// In BLEManager.cpp setupCharacteristics():
// DSHOT Command characteristic (write)
pDshotCommandCharacteristic = pService->createCharacteristic(
    BLEUUID("12345678-1234-5678-1234-56789abcdef5"),
    BLECharacteristic::PROPERTY_WRITE
);

// DSHOT Response characteristic (notify)
pDshotResponseCharacteristic = pService->createCharacteristic(
    BLEUUID("12345678-1234-5678-1234-56789abcdef6"),
    BLECharacteristic::PROPERTY_NOTIFY
);
pDshotResponseCharacteristic->addDescriptor(new BLE2902());
```

### Step 2: Implement Command Handler

```cpp
// In BLEManager.cpp, create callback class:
class DSHOTCommandCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() != 1) return;
        
        uint8_t command = value[0];
        handleDSHOTCommand(command);
    }
};

// Register callback in setupCharacteristics():
pDshotCommandCharacteristic->setCallbacks(new DSHOTCommandCallbacks());
```

### Step 3: Handle DSHOT Commands

```cpp
void handleDSHOTCommand(uint8_t command) {
    switch (command) {
        case 1: case 2: case 3: case 4: case 5:
            // Beep commands - send to ESC via DSHOT
            sendDSHOTSpecialCommand(command);
            sendAckResponse();
            break;
            
        case 6: // ESC_INFO
            sendESCInfoResponse();
            break;
            
        case 7: case 8: // SPIN_DIRECTION (legacy)
        case 20: case 21: // SPIN_DIRECTION (explicit)
            sendDSHOTSpecialCommand(command);
            sendAckResponse();
            break;
            
        case 9: case 10: // MODE_3D
            sendDSHOTSpecialCommand(command);
            sendAckResponse();
            break;
            
        case 12: // SAVE_SETTINGS
            sendDSHOTSpecialCommand(command);
            sendAckResponse();
            break;
            
        case 22: case 23: case 24: case 25: // LED_ON
        case 26: case 27: case 28: case 29: // LED_OFF
            sendDSHOTSpecialCommand(command);
            sendAckResponse();
            break;
            
        default:
            Serial.println("Unknown DSHOT command");
            break;
    }
}
```

### Step 4: Send Responses

```cpp
void sendAckResponse() {
    uint8_t response[1] = {0}; // Type 0 = ack
    pDshotResponseCharacteristic->setValue(response, 1);
    pDshotResponseCharacteristic->notify();
}

void sendESCInfoResponse() {
    // Response format:
    // [0] = type (1 = info)
    // [1] = firmware version (from ESC telemetry if available, or 0)
    // [2] = rotation direction (0 = normal, 1 = reversed)
    // [3] = 3D mode (0 = off, 1 = on)
    
    uint8_t response[4];
    response[0] = 1; // Type: info
    response[1] = 0; // Firmware version (TODO: read from ESC telemetry)
    response[2] = 0; // Direction (TODO: track in ESC class)
    response[3] = 0; // 3D mode (TODO: track in ESC class)
    
    pDshotResponseCharacteristic->setValue(response, 4);
    pDshotResponseCharacteristic->notify();
}
```

### Step 5: Integrate with ESC Class

The `ESC` class needs to be extended to support DSHOT special commands:

```cpp
// In ESC.h, add method:
void sendSpecialCommand(uint8_t command);

// In ESC.cpp, implement:
void ESC::sendSpecialCommand(uint8_t command) {
    if (_mode != ESCMode::DSHOT || !_dshot) {
        return; // Only works in DSHOT mode
    }
    
    // DSHOT special commands are sent in the range 1-47
    // They should be sent multiple times for reliability
    for (int i = 0; i < 6; i++) {
        _dshot->send_dshot_value(command, DSHOT_TELEMETRIC_ON);
        delay(1); // Small delay between commands
    }
}
```

### Step 6: Call ESC Command from BLE Handler

```cpp
// In handleDSHOTCommand():
extern ESC esc; // Assuming ESC is global or accessible

void sendDSHOTSpecialCommand(uint8_t command) {
    esc.sendSpecialCommand(command);
}
```

## Testing Procedure

### 1. Basic Connectivity Test
1. Connect to device in DSHOT mode
2. Verify DSHOT Commands panel appears below ESC Control
3. Check that all buttons are enabled when not sending

### 2. Beeper Test (Safest)
1. Click "Beep 1" button
2. Should hear single beep from ESC
3. Try Beep 2-5 for different patterns
4. Verify button shows "Sending..." during transmission

### 3. ESC Info Test
1. Click "Read ESC Info" button
2. Verify response appears in info panel
3. Check firmware version, direction, and 3D mode display

### 4. Direction Control Test (⚠️ CAUTION)
1. **Set throttle to 0 and ensure ESC is stopped**
2. Click "Set Normal Direction" or "Set Reversed"
3. Start ESC at low throttle (~10%)
4. Verify motor spins in expected direction
5. Stop immediately if unexpected behavior

### 5. 3D Mode Test (⚠️ Requires 3D-capable ESC)
1. Stop ESC completely
2. Click "Enable 3D Mode" or "Disable 3D Mode"
3. Test bidirectional operation carefully
4. **WARNING**: 3D mode allows motor to spin in reverse at negative throttle

### 6. LED Control Test (if ESC has LEDs)
1. Click LED On/Off buttons for LEDs 0-3
2. Verify ESC LEDs respond
3. Not all ESCs support LED control

### 7. Save Settings Test
1. Make configuration changes (direction, 3D mode, etc.)
2. Click "Save Settings to ESC"
3. Power cycle ESC
4. Verify settings persisted

## Safety Notes

⚠️ **IMPORTANT SAFETY WARNINGS**:

1. **Direction Reversal**: Always test at low throttle first. Motor spinning unexpectedly in reverse can cause crashes or injury.

2. **3D Mode**: Only enable on compatible ESCs. Can cause motor to spin in reverse, which is dangerous on some vehicles.

3. **Save Settings**: Be careful when saving settings to EEPROM. Incorrect settings can make ESC behave unexpectedly on next power-up.

4. **Testing**: Always test DSHOT commands with propeller removed first. Only add propeller after confirming safe operation.

5. **Firmware Updates**: Some ESCs may require firmware updates to support all DSHOT special commands.

## Command Reference

### DSHOT Special Commands (from BLHeli_32 specification)

| Command | Value | Description |
|---------|-------|-------------|
| BEEP1 | 1 | Short beep |
| BEEP2 | 2 | Medium beep |
| BEEP3 | 3 | Long beep |
| BEEP4 | 4 | Very long beep |
| BEEP5 | 5 | Continuous beep |
| ESC_INFO | 6 | Request ESC info (firmware, settings) |
| SPIN_DIRECTION_1 | 7 | Toggle rotation direction |
| SPIN_DIRECTION_2 | 8 | Toggle rotation direction (alternate) |
| MODE_3D_OFF | 9 | Disable 3D mode (unidirectional) |
| MODE_3D_ON | 10 | Enable 3D mode (bidirectional) |
| SETTINGS_REQUEST | 11 | Request settings info |
| SAVE_SETTINGS | 12 | Save current settings to EEPROM |
| SPIN_DIRECTION_NORMAL | 20 | Set normal direction (explicit) |
| SPIN_DIRECTION_REVERSED | 21 | Set reversed direction (explicit) |
| LED0_ON to LED3_ON | 22-25 | Turn on LED 0-3 |
| LED0_OFF to LED3_OFF | 26-29 | Turn off LED 0-3 |

### Response Packet Format

#### Acknowledgment Response
```
[0] = 0  // Type: ack
```

#### ESC Info Response
```
[0] = 1  // Type: info
[1] = firmware version (uint8_t)
[2] = rotation direction (0=normal, 1=reversed)
[3] = 3D mode (0=disabled, 1=enabled)
```

#### Settings Response
```
[0] = 2  // Type: settings
// Additional bytes TBD based on ESC capabilities
```

## Next Steps

1. **Firmware Implementation**: Add BLE characteristics and command handlers to firmware
2. **ESC Integration**: Extend ESC class to support DSHOT special commands
3. **Testing**: Thoroughly test each command type with propeller removed
4. **Documentation**: Update main README with DSHOT commands feature
5. **Safety Testing**: Verify all safety interlocks work correctly

## Known Limitations

1. **ESC Compatibility**: Not all ESCs support all DSHOT special commands
2. **Firmware Version**: ESC info reading requires ESC telemetry support
3. **Settings Persistence**: SAVE_SETTINGS may not be supported by all ESCs
4. **LED Control**: Only works with ESCs that have controllable LEDs
5. **3D Mode**: Requires BLHeli_32 or compatible ESC firmware

## Unit Conversion Formulas

### Tip Speed Calculation
```
speed (m/s) = π × diameter (m) × RPM / 60

Conversions:
- m/s to km/h: × 3.6
- m/s to mph: × 2.23694
- m/s to ft/s: × 3.28084
```

### Kinetic Energy Calculation
```
ω (rad/s) = 2π × RPM / 60
KE (Joules) = 0.5 × MOI (kg·m²) × ω²
```

### Diameter Conversions to Meters
```
inches: × 0.0254
mm: / 1000
cm: / 100
```

### MOI Conversions to kg·m²
```
kg·mm²: / 1,000,000
kg·cm²: / 10,000
kg·m²: as-is
g·cm²: / 10,000,000
```
