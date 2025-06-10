import { PowrmaticAirConditioner } from '../src/platformAccessory';
import { HomebridgePowrmatic } from '../src/platform';
import {
  API,
  PlatformConfig,
  Logger,
  PlatformAccessory,
} from 'homebridge';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockLog: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

const mockConfig: PlatformConfig = {
  platform: 'Powrmatic',
};

const mockApi = {
  hap: {
    Service: {
      AccessoryInformation: 'AccessoryInformation',
      HeaterCooler: 'HeaterCooler',
    },
    Characteristic: {
      Manufacturer: 'Manufacturer',
      Model: 'Model',
      SerialNumber: 'SerialNumber',
      Name: 'Name',
      Active: {
        ACTIVE: 1,
        INACTIVE: 0,
      },
      TargetHeaterCoolerState: {
        HEAT: 1,
        COOL: 2,
        AUTO: 0,
      },
      CurrentHeaterCoolerState: {
        HEATING: 1,
        COOLING: 2,
        IDLE: 0,
      },
      RotationSpeed: 'RotationSpeed',
      SwingMode: {
        SWING_ENABLED: 1,
        SWING_DISABLED: 0,
      },
      CoolingThresholdTemperature: 'CoolingThresholdTemperature',
      HeatingThresholdTemperature: 'HeatingThresholdTemperature',
      CurrentTemperature: 'CurrentTemperature',
    },
    uuid: {
      generate: jest.fn().mockReturnValue('test-uuid'),
    },
  },
  on: jest.fn(),
} as unknown as API;

const mockPlatform = new HomebridgePowrmatic(mockLog, mockConfig, mockApi);

const mockAccessory: PlatformAccessory = {
  displayName: 'Test AC',
  UUID: 'test-uuid',
  context: {
    device: {
      ipAddress: '127.0.0.1',
      displayName: 'Test AC',
    },
  },
  getService: jest.fn(),
  addService: jest.fn(),
} as unknown as PlatformAccessory;

// Mock the service and characteristic chain
const mockService = {
  setCharacteristic: jest.fn().mockReturnThis(),
  getCharacteristic: jest.fn().mockReturnThis(),
  updateCharacteristic: jest.fn().mockReturnThis(),
  onSet: jest.fn().mockReturnThis(),
  setProps: jest.fn().mockReturnThis(),
};

(mockAccessory.getService as jest.Mock).mockReturnValue(mockService);
(mockAccessory.addService as jest.Mock).mockReturnValue(mockService);
(mockService.getCharacteristic as jest.Mock).mockReturnValue(mockService);

describe('PowrmaticAirConditioner', () => {
  let ac: PowrmaticAirConditioner;

  beforeAll(() => {
    // Stop timers, such as the 5-second interval, from running
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ac = new PowrmaticAirConditioner(mockPlatform, mockAccessory);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should be created', () => {
    expect(ac).toBeInstanceOf(PowrmaticAirConditioner);
    expect(mockAccessory.getService).toHaveBeenCalledWith('AccessoryInformation');
    expect(mockAccessory.getService).toHaveBeenCalledWith('HeaterCooler');
  });

  it('should set active state to on', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });
    await ac.setActive(mockApi.hap.Characteristic.Active.ACTIVE);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://127.0.0.1/api/v/1/power/on',
      {},
      { timeout: 5000 },
    );
  });

  it('should set active state to off', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });
    await ac.setActive(mockApi.hap.Characteristic.Active.INACTIVE);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://127.0.0.1/api/v/1/power/off',
      {},
      { timeout: 5000 },
    );
  });

  it('should set target state to cool', async () => {
    mockedAxios.post.mockResolvedValue({ data: { success: true } });
    await ac.setTargetHeaterCoolerState(mockApi.hap.Characteristic.TargetHeaterCoolerState.COOL);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://127.0.0.1/api/v/1/set/mode/cooling',
      {},
      { timeout: 5000 },
    );
  });

  it('should get device status and update characteristics', async () => {
    const mockStatus = {
      ps: 1, // on
      wm: 1, // cool
      t: 25, // current temp
      sp: 22, // target temp
      fs: 1, // fan speed
      fr: 0, // swing on
    };
    mockedAxios.get.mockResolvedValue({ data: { success: true, RESULT: mockStatus } });

    // Manually trigger the interval
    await jest.advanceTimersByTimeAsync(5000);

    expect(mockedAxios.get).toHaveBeenCalledWith('http://127.0.0.1/api/v/1/status', { timeout: 5000 });
    const { Active, CurrentTemperature, CurrentHeaterCoolerState, TargetHeaterCoolerState, RotationSpeed, SwingMode,
      CoolingThresholdTemperature, HeatingThresholdTemperature } = mockPlatform.Characteristic;
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(Active, Active.ACTIVE);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(CurrentHeaterCoolerState, CurrentHeaterCoolerState.COOLING);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(TargetHeaterCoolerState, TargetHeaterCoolerState.COOL);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(CurrentTemperature, 25);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(RotationSpeed, 25);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(SwingMode, SwingMode.SWING_ENABLED);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(CoolingThresholdTemperature, 22);
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith(HeatingThresholdTemperature, 22);
  });
});