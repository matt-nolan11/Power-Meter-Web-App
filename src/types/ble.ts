// BLE Service and Characteristic UUIDs
export const BLE_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
export const BLE_CHAR_DATA_UUID = '12345678-1234-5678-1234-56789abcdef1';
export const BLE_CHAR_BATTERY_UUID = '12345678-1234-5678-1234-56789abcdef2';
export const BLE_CHAR_CONFIG_UUID = '12345678-1234-5678-1234-56789abcdef3';
export const BLE_CHAR_COMMAND_UUID = '12345678-1234-5678-1234-56789abcdef4';
export const BLE_CHAR_DSHOT_COMMAND_UUID = '12345678-1234-5678-1234-56789abcdef5';
export const BLE_CHAR_DSHOT_RESPONSE_UUID = '12345678-1234-5678-1234-56789abcdef6';

// ESC Modes and Types
export enum ESCMode {
  PWM = 0,
  DSHOT = 1
}

export enum ESCType {
  UNIDIRECTIONAL = 0,
  BIDIRECTIONAL = 1
}

export enum DSHOTSpeed {
  DSHOT150 = 150,
  DSHOT300 = 300,
  DSHOT600 = 600,
  DSHOT1200 = 1200,
  DSHOT2400 = 2400
}

export enum BatteryState {
  NORMAL = 0,
  WARNING = 1,
  CUTOFF = 2
}

// Display-only settings (not sent to device)
export enum DiameterUnit {
  INCHES = 'inches',
  MM = 'mm',
  CM = 'cm'
}

export enum MOIUnit {
  KG_MM2 = 'kg·mm²',
  KG_CM2 = 'kg·cm²',
  KG_M2 = 'kg·m²',
  G_CM2 = 'g·cm²'
}

export enum TipSpeedUnit {
  MPH = 'mph',
  MS = 'm/s',
  KMH = 'km/h',
  FTS = 'ft/s'
}

// DSHOT Special Commands (common commands)
export enum DSHOTSpecialCommand {
  BEEP1 = 1,
  BEEP2 = 2,
  BEEP3 = 3,
  BEEP4 = 4,
  BEEP5 = 5,
  ESC_INFO = 6,          // Request ESC info
  SPIN_DIRECTION_1 = 7,  // Normal direction
  SPIN_DIRECTION_2 = 8,  // Reverse direction
  MODE_3D_OFF = 9,
  MODE_3D_ON = 10,
  SETTINGS_REQUEST = 11,  // Request current settings
  SAVE_SETTINGS = 12,     // Save settings to EEPROM
  SPIN_DIRECTION_NORMAL = 20,
  SPIN_DIRECTION_REVERSED = 21,
  LED0_ON = 22,
  LED1_ON = 23,
  LED2_ON = 24,
  LED3_ON = 25,
  LED0_OFF = 26,
  LED1_OFF = 27,
  LED2_OFF = 28,
  LED3_OFF = 29
}

// DSHOT Command Packet (1 byte)
export interface DSHOTCommandPacket {
  command: DSHOTSpecialCommand;  // uint8_t (1 byte)
}

// DSHOT Response Packet (variable, starts with type indicator)
export interface DSHOTResponsePacket {
  type: 'info' | 'settings' | 'ack';
  data?: {
    firmwareVersion?: number;
    rotationDirection?: number;
    mode3D?: boolean;
    // Additional fields as needed
  };
}

export interface DSHOTDisplaySettings {
  diameter: number;
  diameterUnit: DiameterUnit;
  moi: number;
  moiUnit: MOIUnit;
  tipSpeedUnit: TipSpeedUnit;
}

// PWM Data Packet (13 bytes)
export interface PWMDataPacket {
  voltage: number;      // float (4 bytes)
  current: number;      // float (4 bytes)
  throttle: number;     // float (4 bytes) - percentage
  batteryState: BatteryState; // uint8_t (1 byte)
}

// DSHOT Data Packet (31 bytes) - PWM data + telemetry
export interface DSHOTDataPacket extends PWMDataPacket {
  rpm: number;          // uint32_t (4 bytes)
  temp: number;         // uint32_t (4 bytes)
  escVoltage: number;   // float (4 bytes)
  escCurrent: number;   // uint32_t (4 bytes)
  lastStatus: number;   // uint32_t (4 bytes)
  stress: number;       // uint32_t (4 bytes)
}

// ESC Config Packet (19 bytes)
export interface ESCConfigPacket {
  mode: ESCMode;              // uint8_t (1 byte)
  escType: ESCType;           // uint8_t (1 byte)
  throttleMin: number;        // uint16_t (2 bytes)
  throttleMax: number;        // uint16_t (2 bytes)
  rampUpRate: number;         // uint16_t (2 bytes)
  rampDownRate: number;       // uint16_t (2 bytes)
  rampUpEnabled: boolean;     // uint8_t (1 byte)
  rampDownEnabled: boolean;   // uint8_t (1 byte)
  batteryCells: number;       // uint8_t (1 byte)
  batteryCutoff: number;      // uint16_t (2 bytes) - in millivolts
  batteryWarningDelta: number;// uint16_t (2 bytes) - in millivolts
  batteryProtectionEnabled: boolean; // uint8_t (1 byte)
  motorPoles: number;         // uint8_t (1 byte)
}

// ESC Command Packet (5 bytes)
export interface ESCCommandPacket {
  command: number;      // uint8_t (1 byte) - 0=STOP, 1=START
  throttle: number;     // float (4 bytes) - percentage
}

// Battery Status Packet (5 bytes)
export interface BatteryStatusPacket {
  state: BatteryState;  // uint8_t (1 byte)
  voltage: number;      // float (4 bytes)
}

// Helper functions to parse binary data
export class BLEDataParser {
  private static littleEndian = true;

  static parsePWMData(buffer: ArrayBuffer): PWMDataPacket {
    const view = new DataView(buffer);
    return {
      voltage: view.getFloat32(0, this.littleEndian),
      current: view.getFloat32(4, this.littleEndian),
      throttle: view.getFloat32(8, this.littleEndian),
      batteryState: view.getUint8(12) as BatteryState
    };
  }

  static parseDSHOTData(buffer: ArrayBuffer): DSHOTDataPacket {
    const view = new DataView(buffer);
    return {
      // PWM data (first 12 bytes)
      voltage: view.getFloat32(0, this.littleEndian),
      current: view.getFloat32(4, this.littleEndian),
      throttle: view.getFloat32(8, this.littleEndian),
      // Telemetry data (remaining 18 bytes)
      rpm: view.getUint32(12, this.littleEndian),
      escVoltage: view.getFloat32(16, this.littleEndian),
      escCurrent: view.getUint32(20, this.littleEndian),
      temp: view.getUint16(24, this.littleEndian),
      lastStatus: view.getUint16(26, this.littleEndian),
      stress: view.getUint16(28, this.littleEndian),
      batteryState: view.getUint8(30) as BatteryState
    };
  }

  static parseBatteryStatus(buffer: ArrayBuffer): BatteryStatusPacket {
    const view = new DataView(buffer);
    return {
      state: view.getUint8(0) as BatteryState,
      voltage: view.getFloat32(1, this.littleEndian)
    };
  }

  static encodeConfig(config: ESCConfigPacket): ArrayBuffer {
    const buffer = new ArrayBuffer(19);
    const view = new DataView(buffer);
    
    view.setUint8(0, config.mode);
    view.setUint8(1, config.escType);
    view.setUint16(2, config.throttleMin, this.littleEndian);
    view.setUint16(4, config.throttleMax, this.littleEndian);
    view.setUint16(6, config.rampUpRate, this.littleEndian);
    view.setUint16(8, config.rampDownRate, this.littleEndian);
    view.setUint8(10, config.rampUpEnabled ? 1 : 0);
    view.setUint8(11, config.rampDownEnabled ? 1 : 0);
    view.setUint8(12, config.batteryCells);
    view.setUint16(13, config.batteryCutoff, this.littleEndian); // millivolts
    view.setUint16(15, config.batteryWarningDelta, this.littleEndian); // millivolts
    view.setUint8(17, config.batteryProtectionEnabled ? 1 : 0);
    view.setUint8(18, config.motorPoles);
    
    return buffer;
  }

  static encodeCommand(command: ESCCommandPacket): ArrayBuffer {
    const buffer = new ArrayBuffer(5);
    const view = new DataView(buffer);
    
    view.setUint8(0, command.command);
    view.setFloat32(1, command.throttle, this.littleEndian);
    
    return buffer;
  }
}
