import {
  BLE_SERVICE_UUID,
  BLE_CHAR_DATA_UUID,
  BLE_CHAR_BATTERY_UUID,
  BLE_CHAR_CONFIG_UUID,
  BLE_CHAR_COMMAND_UUID,
  BLE_CHAR_DSHOT_COMMAND_UUID,
  BLE_CHAR_DSHOT_RESPONSE_UUID,
  PWMDataPacket,
  DSHOTDataPacket,
  BatteryStatusPacket,
  ESCConfigPacket,
  ESCCommandPacket,
  DSHOTSpecialCommand,
  DSHOTResponsePacket,
  BLEDataParser
} from '../types/ble';

export type DataCallback = (data: PWMDataPacket | DSHOTDataPacket) => void;
export type BatteryCallback = (status: BatteryStatusPacket) => void;
export type ConnectionCallback = (connected: boolean) => void;
export type DSHOTResponseCallback = (response: DSHOTResponsePacket) => void;

export class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private dataCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private batteryCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private configCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private commandCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private dshotCommandCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private dshotResponseCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  private dataCallback: DataCallback | null = null;
  private batteryCallback: BatteryCallback | null = null;
  private connectionCallback: ConnectionCallback | null = null;
  private dshotResponseCallback: DSHOTResponseCallback | null = null;

  async connect(): Promise<void> {
    try {
      // Request device - filter by name prefix to show only relevant devices
      // This allows multiple power meter devices while filtering out unrelated BLE devices
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'RC Power Meter' },
          { namePrefix: 'Pico' }
        ],
        optionalServices: [BLE_SERVICE_UUID]
      });

      // Add disconnect listener
      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();
      console.log('Connected to GATT server');

      // Get service
      const service = await this.server.getPrimaryService(BLE_SERVICE_UUID);
      console.log('Got BLE service');

      // Get characteristics
      this.dataCharacteristic = await service.getCharacteristic(BLE_CHAR_DATA_UUID);
      this.batteryCharacteristic = await service.getCharacteristic(BLE_CHAR_BATTERY_UUID);
      this.configCharacteristic = await service.getCharacteristic(BLE_CHAR_CONFIG_UUID);
      this.commandCharacteristic = await service.getCharacteristic(BLE_CHAR_COMMAND_UUID);
      
      // Try to get DSHOT characteristics (optional, may not be supported by older firmware)
      try {
        this.dshotCommandCharacteristic = await service.getCharacteristic(BLE_CHAR_DSHOT_COMMAND_UUID);
        this.dshotResponseCharacteristic = await service.getCharacteristic(BLE_CHAR_DSHOT_RESPONSE_UUID);
        console.log('DSHOT command characteristics found');
      } catch (error) {
        console.log('DSHOT commands not supported by this firmware version');
        this.dshotCommandCharacteristic = null;
        this.dshotResponseCharacteristic = null;
      }
      
      console.log('Got all characteristics');

      // Start notifications
      await this.dataCharacteristic.startNotifications();
      this.dataCharacteristic.addEventListener('characteristicvaluechanged', 
        this.onDataReceived.bind(this));

      await this.batteryCharacteristic.startNotifications();
      this.batteryCharacteristic.addEventListener('characteristicvaluechanged',
        this.onBatteryReceived.bind(this));

      // Start DSHOT response notifications if supported
      if (this.dshotResponseCharacteristic) {
        await this.dshotResponseCharacteristic.startNotifications();
        this.dshotResponseCharacteristic.addEventListener('characteristicvaluechanged',
          this.onDSHOTResponse.bind(this));
      }

      console.log('Started notifications');
      
      if (this.connectionCallback) {
        this.connectionCallback(true);
      }
    } catch (error) {
      console.error('BLE connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.server && this.server.connected) {
      await this.server.disconnect();
    }
    this.device = null;
    this.server = null;
    this.dataCharacteristic = null;
    this.batteryCharacteristic = null;
    this.configCharacteristic = null;
    this.commandCharacteristic = null;
    this.dshotCommandCharacteristic = null;
    this.dshotResponseCharacteristic = null;
  }

  private onDisconnected(): void {
    console.log('Device disconnected');
    if (this.connectionCallback) {
      this.connectionCallback(false);
    }
  }

  private onDataReceived(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const buffer = target.value!.buffer as ArrayBuffer;

    let data: PWMDataPacket | DSHOTDataPacket;
    
    // Parse based on packet size (handles mode transitions gracefully)
    if (buffer.byteLength === 13) {
      data = BLEDataParser.parsePWMData(buffer);
    } else if (buffer.byteLength === 31) {
      data = BLEDataParser.parseDSHOTData(buffer);
    } else {
      // Silently ignore invalid packets (can happen during mode transitions)
      return;
    }

    // Extract battery state from data packet and call battery callback
    if (this.batteryCallback) {
      this.batteryCallback({
        state: data.batteryState,
        voltage: data.voltage
      });
    }

    if (this.dataCallback) {
      this.dataCallback(data);
    }
  }

  private onBatteryReceived(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const buffer = target.value!.buffer as ArrayBuffer;

    const status = BLEDataParser.parseBatteryStatus(buffer);

    if (this.batteryCallback) {
      this.batteryCallback(status);
    }
  }

  async sendConfig(config: ESCConfigPacket): Promise<void> {
    if (!this.configCharacteristic) {
      throw new Error('Not connected');
    }

    const buffer = BLEDataParser.encodeConfig(config);
    await this.configCharacteristic.writeValue(buffer);
    console.log('Config sent:', config);
  }

  async sendCommand(command: ESCCommandPacket): Promise<void> {
    if (!this.commandCharacteristic) {
      throw new Error('Not connected');
    }

    const buffer = BLEDataParser.encodeCommand(command);
    await this.commandCharacteristic.writeValue(buffer);
    console.log('Command sent:', command);
  }

  setDataCallback(callback: DataCallback): void {
    this.dataCallback = callback;
  }

  setBatteryCallback(callback: BatteryCallback): void {
    this.batteryCallback = callback;
  }

  setConnectionCallback(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  setDSHOTResponseCallback(callback: DSHOTResponseCallback): void {
    this.dshotResponseCallback = callback;
  }

  async sendDSHOTCommand(command: DSHOTSpecialCommand): Promise<void> {
    if (!this.dshotCommandCharacteristic) {
      throw new Error('Not connected or DSHOT commands not supported');
    }

    const buffer = new Uint8Array([command]);
    await this.dshotCommandCharacteristic.writeValue(buffer);
    console.log('DSHOT command sent:', command);
  }

  private onDSHOTResponse(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const buffer = target.value!.buffer as ArrayBuffer;
    const view = new DataView(buffer);

    if (buffer.byteLength === 0) {
      console.warn('Empty DSHOT response received');
      return;
    }

    const type = view.getUint8(0);
    const response: DSHOTResponsePacket = { type: 'ack' };

    // Parse based on response type
    if (type === 1 && buffer.byteLength >= 4) {
      // ESC Info response
      response.type = 'info';
      response.data = {
        firmwareVersion: view.getUint8(1),
        rotationDirection: view.getUint8(2),
        mode3D: view.getUint8(3) === 1
      };
    } else if (type === 2) {
      // Settings response
      response.type = 'settings';
    }

    console.log('DSHOT response:', response);

    if (this.dshotResponseCallback) {
      this.dshotResponseCallback(response);
    }
  }

  isConnected(): boolean {
    return this.server?.connected ?? false;
  }

  getDeviceId(): string | null {
    return this.device?.id || null;
  }

  getDeviceName(): string {
    return this.device?.name ?? 'Unknown Device';
  }
}
