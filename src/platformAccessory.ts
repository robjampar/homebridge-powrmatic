import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {HomebridgePowrmatic} from './platform';
import fetch from 'node-fetch';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class PowrmaticAirConditioner {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    active: false,
    Brightness: 100,
  };

  constructor(
    private readonly platform: HomebridgePowrmatic,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Powrmatic')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the HeaterCooler service if it exists, otherwise create a new HeaterCooler service
    // eslint-disable-next-line max-len
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    // set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(this.setRotationSpeed.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onSet(this.setSwingMode.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    /**
     * Updating characteristics values asynchronously.
     */

    setInterval(() => {
      this.platform.log.debug('Updating HomeKit');

      this.getDeviceStatus().then((status) => {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, status);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, true);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, motionDetected);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, motionDetected);
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, motionDetected);
        this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, motionDetected);
        this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, motionDetected);
        this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, motionDetected);
      });

    }, 10000);
  }

  async setActive(value: CharacteristicValue) {
    this.updateDevice('test', 'test');
    this.platform.log.debug('Set Characteristic Active ->', value);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic TargetHeaterCoolerState ->', value);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic RotationSpeed ->', value);
  }

  async setSwingMode(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic SwingMode ->', value);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic CoolingThresholdTemperature ->', value);
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic HeatingThresholdTemperature ->', value);
  }

  async getDeviceStatus() {
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/status`;
    this.platform.log.debug('Getting status -> ' + url);

    const response = await fetch(url);
    if (response.status == 200) {
      return await response.json();
    }
    this.platform.log.debug('Error reaching device');
  }

  updateDevice(endpoint, params = {}) {
    const query = Object.keys(params).map(x => `${x}=${params[x]}`).join('&');
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/${endpoint}?${query}`;

    this.platform.log.debug('Updating Device -> ' + url);
    fetch(url, {method: 'POST'}).then(r => {
      this.platform.log.debug('Updating Device -> ' + url + ' response -> ' + r.status);
    });

  }

}
