/**
 * Device Settings Storage
 * Manages persistent storage of device-specific settings in localStorage
 */

import { ESCConfigPacket, DSHOTDisplaySettings } from '../types/ble';

interface DeviceSettings {
  name: string;
  config: ESCConfigPacket;
  dshotSettings?: DSHOTDisplaySettings;
  lastConnected: number; // timestamp
}

const STORAGE_KEY = 'rc-power-meter-devices';
const DEVICE_COUNTER_KEY = 'rc-power-meter-device-counter';

export class DeviceStorage {
  /**
   * Get device settings by MAC address
   */
  static getDevice(deviceId: string): DeviceSettings | null {
    const devices = this.getAllDevices();
    return devices[deviceId] || null;
  }

  /**
   * Save device settings
   */
  static saveDevice(deviceId: string, settings: DeviceSettings): void {
    const devices = this.getAllDevices();
    devices[deviceId] = {
      ...settings,
      lastConnected: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }

  /**
   * Get all stored devices
   */
  static getAllDevices(): Record<string, DeviceSettings> {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Remove device settings
   */
  static removeDevice(deviceId: string): void {
    const devices = this.getAllDevices();
    delete devices[deviceId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }

  /**
   * Generate next default device name
   */
  static getNextDeviceName(): string {
    const counter = parseInt(localStorage.getItem(DEVICE_COUNTER_KEY) || '0', 10);
    const nextCounter = counter + 1;
    localStorage.setItem(DEVICE_COUNTER_KEY, nextCounter.toString());
    return `Power Meter ${nextCounter}`;
  }

  /**
   * Update device name
   */
  static updateDeviceName(deviceId: string, newName: string): void {
    const device = this.getDevice(deviceId);
    if (device) {
      device.name = newName;
      this.saveDevice(deviceId, device);
    }
  }

  /**
   * Clear all stored devices
   */
  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DEVICE_COUNTER_KEY);
  }
}
