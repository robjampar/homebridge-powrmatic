import { HomebridgePowrmatic } from '../src/platform';
import { API, PlatformConfig, Logger, PlatformAccessory } from 'homebridge';
import { PLATFORM_NAME } from '../src/settings';

// A more robust mock for the API
const mockApi = {
  hap: {
    Service: {
      AccessoryInformation: 'AccessoryInformation',
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
      generate: jest.fn().mockReturnValue('mock-uuid'),
    },
  },
  platformAccessory: jest.fn().mockImplementation((displayName, uuid) => {
    return {
      displayName,
      UUID: uuid,
      context: {},
      getService: jest.fn().mockReturnValue({
        setCharacteristic: jest.fn().mockReturnThis(),
        getCharacteristic: jest.fn().mockReturnValue({
          onSet: jest.fn().mockReturnThis(),
          setProps: jest.fn().mockReturnThis(),
        }),
      }),
    } as unknown as PlatformAccessory;
  }),
  registerPlatformAccessories: jest.fn(),
  // We will control the 'didFinishLaunching' event manually in the tests
  on: jest.fn(),
} as unknown as API;

const mockLog = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

const createMockAccessory = (displayName: string, uuid: string, ipAddress: string): PlatformAccessory => {
  return {
    displayName,
    UUID: uuid,
    context: {
      device: {
        ipAddress: ipAddress,
        displayName: displayName,
      },
    },
    getService: jest.fn().mockReturnValue({
      setCharacteristic: jest.fn().mockReturnThis(),
      getCharacteristic: jest.fn().mockReturnValue({
        onSet: jest.fn().mockReturnThis(),
        setProps: jest.fn().mockReturnThis(),
      }),
    }),
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

    // Capture the 'didFinishLaunching' callback
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
    expect(mockLog.info).toHaveBeenCalledWith('Finished initializing platform:', 'Powrmatic');
    expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
  });

  it('should discover devices on didFinishLaunching', () => {
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Executed didFinishLaunching callback');
    expect(mockLog.info).toHaveBeenCalledWith('Discovering devices...');
  });

  it('should register a new accessory', () => {
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Adding new accessory:', 'Test AC');
    expect(mockApi.platformAccessory).toHaveBeenCalledWith('Test AC', 'mock-uuid');
    expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
  });

  it('should restore an existing accessory', () => {
    const existingAccessory = createMockAccessory('Test AC', 'mock-uuid', '192.168.1.1');
    platform.accessories.push(existingAccessory);
    triggerDidFinishLaunching();
    expect(mockLog.info).toHaveBeenCalledWith('Restoring existing accessory from cache:', 'Test AC');
  });

  it('should handle an empty device list', () => {
    const configWithEmptyDevices: PlatformConfig = {
      ...mockConfig,
      devices: [],
    };
    platform.discoverDevices(configWithEmptyDevices);
    expect(mockApi.platformAccessory).not.toHaveBeenCalled();
  });

  it('should handle missing device config', () => {
    const configWithoutDevices: PlatformConfig = {
      platform: PLATFORM_NAME,
      name: 'Powrmatic',
    };
    // discoverDevices will be called from the constructor via didFinishLaunching
    new HomebridgePowrmatic(mockLog, configWithoutDevices, mockApi);
    if(didFinishLaunchingCallback){
      didFinishLaunchingCallback();
    }
    expect(mockLog.info).toHaveBeenCalledWith('No device config found in config.json');
  });
});