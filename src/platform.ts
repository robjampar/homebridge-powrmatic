import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { PowrmaticAirConditioner } from './platformAccessory';

export class HomebridgePowrmatic implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.info('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.info('Executed didFinishLaunching callback');
      this.discoverDevices(config);
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.log.debug('Accessory UUID:', accessory.UUID);

    this.accessories.push(accessory);
  }

  discoverDevices(config: PlatformConfig) {
    this.log.debug('discoverDevices called');
    if (!config || !Object.prototype.hasOwnProperty.call(config, 'devices')) {
      this.log.info('No device config found in config.json');
      return;
    }

    this.log.info('Discovering devices...');
    const devices = config.devices;
    this.log.debug('Found devices:', JSON.stringify(devices));

    for (const device of devices) {
      if (!device.ipAddress || !device.displayName) {
        this.log.warn('Skipping device with missing ipAddress or displayName');
        continue;
      }

      const uuid = this.api.hap.uuid.generate(device.ipAddress);
      this.log.debug(`Generated UUID for device ${device.displayName} (${device.ipAddress}): ${uuid}`);

      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        this.log.debug('Existing accessory details:', JSON.stringify(existingAccessory, null, 2));

        new PowrmaticAirConditioner(this, existingAccessory);
        this.log.debug('PowrmaticAirConditioner instance created for existing accessory.');

      } else {
        this.log.info('Adding new accessory:', device.displayName);

        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = device;
        this.log.debug('Accessory context set:', JSON.stringify(accessory.context, null, 2));

        new PowrmaticAirConditioner(this, accessory);
        this.log.debug('PowrmaticAirConditioner instance created for new accessory.');

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.log.info(`Accessory ${device.displayName} registered.`);
      }
    }
  }
}
