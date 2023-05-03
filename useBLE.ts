/* eslint-disable no-bitwise */
import { useMemo, useState } from "react";
import {
  NativeAppEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from "react-native";
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
} from "react-native-ble-plx";

import RNBluetoothClassic, {
  BluetoothEvent,
  BluetoothEventType,
  BluetoothDevice,
} from "react-native-bluetooth-classic";

import ConnectionAcceptor from "react-native-bluetooth-classic";

import * as ExpoDevice from "expo-device";

import base64 from "react-native-base64";

const DEVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const DEVICE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";

interface BluetoothLowEnergyApi {
  justReceive(): void;
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  connectToDevice: (deviceId: Device) => Promise<void>;
  disconnectFromDevice: () => void;
  connectedDevice: Device | null;
  allDevices: Device[] | BluetoothDevice[];
  sendMessage(Device: Device, message: string): Promise<void>;
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = useMemo(() => new BleManager(), []);
  const [allDevices, setAllDevices] = useState<Device[] | BluetoothDevice[]>(
    []
  );
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  // Android 11+ requires additional permissions
  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  // Request permissions for BLE
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location",
            buttonPositive: "OK",
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted =
          await requestAndroid31Permissions();

        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  const justReceive = async () => {
    const btAdaptor = RNBluetoothClassic;

    try {
      const discoverableIntent = await btAdaptor.accept({});
      console.log("discoverableIntent", discoverableIntent);
    } catch (error) {
      console.log(error);
    }
  };

  // Check if device is already in the list
  const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  // Scan for peripherals
  const scanForPeripherals = async () => {
    const btAdaptor = RNBluetoothClassic;
    const waitForScan = async () => {
      return await btAdaptor.startDiscovery();
    };

    const devices = await waitForScan();

    setAllDevices([...devices]);
  };

  // Connect to a device
  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      startStreamingData(deviceConnection);
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
    }
  };

  // Disconnect from a device
  const disconnectFromDevice = () => {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      // TODO: Update some sort of state to show that the device is disconnected
    }
  };

  // Handles receiving data from the device
  const onDeviceDataUpdate = (
    error: BleError | null,
    characteristic: Characteristic | null
  ) => {
    if (error) {
      console.log(error);
      return -1;
    } else if (!characteristic?.value) {
      console.log("No Data was recieved");
      return -1;
    }

    // Decode the data
    const rawData = base64.decode(characteristic.value);

    // TODO: Parse the data & update the state
  };

  // Start streaming data
  const startStreamingData = async (device: Device) => {
    if (device) {
      device.monitorCharacteristicForService(
        DEVICE_UUID,
        DEVICE_CHARACTERISTIC,
        onDeviceDataUpdate
      );
    } else {
      console.log("No Device Connected");
    }
  };

  const sendMessage = async (device: Device, message: string) => {
    if (device) {
      const encodedMessage = base64.encode(message);
      const characteristic =
        await device.writeCharacteristicWithResponseForService(
          DEVICE_UUID,
          DEVICE_CHARACTERISTIC,
          encodedMessage
        );
      console.log(characteristic);
    } else {
      console.log("No Device Connected");
    }
  };

  // Return the API
  return {
    justReceive,
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    disconnectFromDevice,
    sendMessage,
  };
}

export default useBLE;
