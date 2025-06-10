import { HomebridgePowrmatic } from '../src/platform';
import { API, PlatformConfig, Logger, PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME } from '../src/settings';

// A more robust mock for services and characteristics
const mockService = {
  setCharacteristic: jest.fn().mockReturnThis(),
  getCharacteristic: jest.fn().mockReturnThis(),
  onSet: jest.fn().mockReturnThis(),
  setProps: jest.fn().mockReturnThis(),
};

const mockAccessoryGetOrAddService = jest.fn().mockReturnValue(mockService);

// A more robust mock for the API
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
      Active: { ACTIVE: 1, INACTIVE: 0 },
      TargetHeaterCoolerState: { HEAT: 1, COOL: 2, AUTO: 0 },
      CurrentHeaterCoolerState: { HEATING: 1, COOLING: 2, IDLE: 0 },
      RotationSpeed: 'RotationSpeed',
      SwingMode: { SWING_ENABLED: 1, SWING_DISABLED: 0 },
      CoolingThresholdTemperature: 'CoolingThresholdTemperature',
      HeatingThresholdTemperature: 'HeatingThresholdTemperature',
      CurrentTemperature: 'CurrentTemperature',
    },
    uuid: {
      generate: jest.fn().mockReturnValue('mock-uuid'),
    },
  },
  platformAccessory: jest.fn().mockImplementation((displayName, uuid) => ({
    displayName,
    UUID: uuid,
    context: {},
    getService: mockAccessoryGetOrAddService,
    addService: mockAccessoryGetOrAddService,
  })),
  registerPlatformAccessories: jest.fn(),
  on: jest.fn(),
} as unknown as API;

const mockLog: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

const createMockAccessory = (displayName: string, uuid: string, ipAddress: string): PlatformAccessory => {
  return {
    displayName,
    UUID: uuid,
    context: {
      device: {
        ipAddress,
        displayName,
      },
    },
    getService: mockAccessoryGetOrAddService,
    addService: mockAccessoryGetOrAddService,
  } as unknown as PlatformAccessory;
};

describe('HomebridgePowrmatic', () => {
  let platform: HomebridgePowrmatic;
  let didFinishLaunchingCallback: (() => void) | undefined;

  const mockConfig: PlatformConfig = {
    platform: PLATFORM_NAME,
    name: 'Powrmatic',
    devices: [
      {
        ipAddress: '192.168.1.1',
        displayName: 'Test AC',
      },
    ],
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockApi.on as jest.Mock).mockImplementation((event, callback) => {
      if (event === 'didFinishLaunching') {
        didFinishLaunchingCallback = callback;
      }
    });
    platform = new HomebridgePowrmatic(mockLog, mockConfig, mockApi);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  function triggerDidFinishLaunching() {
    if (didFinishLaunchingCallback) {
      didFinishLaunchingCallback();
    } else {
      throw new Error('didFinishLaunching callback not registered');
    }
  }

  it('should initialize correctly and register for didFinishLaunching', () => {
    expect(platform).toBeInstanceOf(HomebridgePowrmatic);
    expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
  });

  it('should discover devices on didFinishLaunching', () => {
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Executed didFinishLaunching callback');
  });

  it('should register a new accessory', () => {
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Adding new accessory:', 'Test AC');
    expect(mockApi.platformAccessory).toHaveBeenCalledWith('Test AC', 'mock-uuid');
  });

  it('should restore an existing accessory', () => {
    const existingAccessory = createMockAccessory('Test AC', 'mock-uuid', '192.168.1.1');
    platform.accessories.push(existingAccessory);
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Restoring existing accessory from cache:', 'Test AC');
  });

  it('should handle an empty device list', () => {
    const configWithEmptyDevices: PlatformConfig = { ...mockConfig, devices: [] };
    const p = new HomebridgePowrmatic(mockLog, configWithEmptyDevices, mockApi);
    triggerDidFinishLaunching.call({
      didFinishLaunchingCallback: (mockApi.on as jest.Mock).mock.calls[1][1],
    });
    expect(p.accessories.length).toBe(0);
  });

  it('should handle missing device config', () => {
    const configWithoutDevices: PlatformConfig = { platform: PLATFORM_NAME, name: 'Powrmatic' };
    new HomebridgePowrmatic(mockLog, configWithoutDevices, mockApi);
    triggerDidFinishLaunching.call({
      didFinishLaunchingCallback: (mockApi.on as jest.Mock).mock.calls[1][1],
    });
    expect(mockLog.info).toHaveBeenCalledWith('No device config found in config.json');
  });
});