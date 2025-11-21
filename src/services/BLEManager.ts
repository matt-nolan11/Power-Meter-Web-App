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
  
  // Flag to prevent onDisconnected callback during intentional disconnect
  private isDisconnecting: boolean = false;
  
  // Heartbeat to keep connection alive
  private heartbeatTimer: number | null = null;
  private lastConfig: ESCConfigPacket | null = null;
  
  // Bound event handlers (to allow proper removal)
  private boundOnDisconnected = this.onDisconnected.bind(this);
  private boundOnDataReceived = this.onDataReceived.bind(this);
  private boundOnBatteryReceived = this.onBatteryReceived.bind(this);
  private boundOnDSHOTResponse = this.onDSHOTResponse.bind(this);

  async connect(): Promise<void> {
    try {
      this.isDisconnecting = false;
      
      // Request device - filter by name prefix to show only relevant devices
      // This allows multiple power meter devices while filtering out unrelated BLE devices
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'RC Power Meter' },
          { namePrefix: 'Pico' }
        ],
        optionalServices: [BLE_SERVICE_UUID]
      });

      // Add disconnect listener (using bound handler for proper cleanup)
      this.device.addEventListener('gattserverdisconnected', this.boundOnDisconnected);

      // Connect to GATT server with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          // If already connected (cached), disconnect first
          if (this.device.gatt?.connected) {
            console.log('Device already connected - disconnecting first');
            await this.device.gatt.disconnect();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          this.server = await this.device.gatt!.connect();
          console.log('Connected to GATT server');
          break; // Success - exit retry loop
        } catch (e) {
          retries--;
          if (retries === 0) throw e;
          console.warn(`Connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Get service
      const service = await this.server!.getPrimaryService(BLE_SERVICE_UUID);
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

      // Start notifications (using bound handlers)
      await this.dataCharacteristic.startNotifications();
      this.dataCharacteristic.addEventListener('characteristicvaluechanged', 
        this.boundOnDataReceived);

      await this.batteryCharacteristic.startNotifications();
      this.batteryCharacteristic.addEventListener('characteristicvaluechanged',
        this.boundOnBatteryReceived);

      // Start DSHOT response notifications if supported
      if (this.dshotResponseCharacteristic) {
        await this.dshotResponseCharacteristic.startNotifications();
        this.dshotResponseCharacteristic.addEventListener('characteristicvaluechanged',
          this.boundOnDSHOTResponse);
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
    try {
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Set flag to prevent onDisconnected callback
      this.isDisconnecting = true;
      
      // Remove disconnect listener before disconnecting
      if (this.device) {
        this.device.removeEventListener('gattserverdisconnected', this.boundOnDisconnected);
      }

      // Stop notifications before disconnecting
      if (this.dataCharacteristic) {
        try {
          await this.dataCharacteristic.stopNotifications();
          this.dataCharacteristic.removeEventListener('characteristicvaluechanged', 
            this.boundOnDataReceived);
        } catch (e) {
          console.warn('Error stopping data notifications:', e);
        }
      }

      if (this.batteryCharacteristic) {
        try {
          await this.batteryCharacteristic.stopNotifications();
          this.batteryCharacteristic.removeEventListener('characteristicvaluechanged',
            this.boundOnBatteryReceived);
        } catch (e) {
          console.warn('Error stopping battery notifications:', e);
        }
      }

      if (this.dshotResponseCharacteristic) {
        try {
          await this.dshotResponseCharacteristic.stopNotifications();
          this.dshotResponseCharacteristic.removeEventListener('characteristicvaluechanged',
            this.boundOnDSHOTResponse);
        } catch (e) {
          console.warn('Error stopping DSHOT response notifications:', e);
        }
      }

      // Disconnect from GATT server
      if (this.server && this.server.connected) {
        await this.server.disconnect();
      }

      // Try to forget the device if supported (Chrome 105+)
      // This clears browser cache and forces fresh pairing next time
      if (this.device && 'forget' in this.device) {
        try {
          await (this.device as any).forget();
          console.log('BLE: Device forgotten - cache cleared');
        } catch (e) {
          // Silently fail - forget() not supported or permission denied
          console.log('BLE: Device.forget() not available');
        }
      }

      // Clear all references
      this.device = null;
      this.server = null;
      this.dataCharacteristic = null;
      this.batteryCharacteristic = null;
      this.configCharacteristic = null;
      this.commandCharacteristic = null;
      this.dshotCommandCharacteristic = null;
      this.dshotResponseCharacteristic = null;

      console.log('BLE: Cleanly disconnected');
      
      // Reset flag after cleanup
      this.isDisconnecting = false;
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Clear references even if disconnect failed
      this.device = null;
      this.server = null;
      this.dataCharacteristic = null;
      this.batteryCharacteristic = null;
      this.configCharacteristic = null;
      this.commandCharacteristic = null;
      this.dshotCommandCharacteristic = null;
      this.dshotResponseCharacteristic = null;
      this.isDisconnecting = false;
    }
  }

  private onDisconnected(): void {
    // Ignore disconnect events during intentional disconnect
    if (this.isDisconnecting) {
      return;
    }
    
    console.log('Device disconnected unexpectedly');
    
    // Stop heartbeat immediately
    this.stopHeartbeat();
    
    // Clear all references to allow reconnection
    this.server = null;
    this.dataCharacteristic = null;
    this.batteryCharacteristic = null;
    this.configCharacteristic = null;
    this.commandCharacteristic = null;
    this.dshotCommandCharacteristic = null;
    this.dshotResponseCharacteristic = null;
    
    // Notify app of disconnect
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
    
    // Store config for heartbeat
    this.lastConfig = config;
    
    // Start heartbeat timer if not already running
    if (!this.heartbeatTimer) {
      console.log('Config sent, starting heartbeat');
      this.startHeartbeat();
    }
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
  
  private startHeartbeat(): void {
    // Stop any existing timer
    this.stopHeartbeat();
    
    console.log('Heartbeat started - PING every 2s');
    
    // Send lightweight ping command every 2 seconds as heartbeat
    this.heartbeatTimer = window.setInterval(async () => {
      // Check if we're actually connected before sending
      if (!this.isConnected() || !this.commandCharacteristic) {
        console.warn('Heartbeat stopped - not connected');
        this.stopHeartbeat();
        return;
      }
      
      try {
        // Send PING command (command 4, throttle 0)
        const buffer = new ArrayBuffer(5);
        const view = new DataView(buffer);
        view.setUint8(0, 4); // PING command
        view.setFloat32(1, 0, true); // throttle (unused for ping)
        
        await this.commandCharacteristic.writeValue(buffer);
        // Don't log success to avoid console spam
      } catch (err) {
        console.error('Heartbeat write failed:', err);
        // Don't stop heartbeat on transient errors - let it retry next interval
        // Only stop if connection is actually dead (checked at top of next interval)
      }
    }, 2000);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getDeviceId(): string | null {
    return this.device?.id || null;
  }

  getDeviceName(): string {
    return this.device?.name ?? 'Unknown Device';
  }
}
