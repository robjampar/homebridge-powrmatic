import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {HomebridgePowrmatic} from './platform';
import axios from 'axios';

interface DeviceStatus {
  ps: number;    // Power 0=off, 1=on
  sp: number;    // Temperature Set point
  fr: number;    // Fan Rotation: 0=on 7=off
  fs: number;    // Fan Speed: 0=auto, 1, 2, 3
  wm: number;    // Mode: 0=heating(?) 1=cooling 2=heating 3=dehumidification, 4=fan only, 5=auto
  t: number;     // Ambient Temperature
}


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
      .setProps({
        minValue: 16,
        maxValue: 31,
        minStep: 1,
      })
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: 16,
        maxValue: 31,
        minStep: 1,
      })
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    /**
     * Updating characteristics values asynchronously.
     */

    setInterval(() => {
      this.platform.log.debug('Updating HomeKit for device ' + this.accessory.context.device.deviceName);

      this.getDeviceStatus().then((status) => {
        if(status) {
          this.service.updateCharacteristic(this.platform.Characteristic.Active,
            (status.ps === 1 ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE),
          );

          let currentState;
          let targetState;
          switch (status.wm) {
            case 0:
              currentState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
              targetState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
              break;
            case 1:
              currentState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
              targetState = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
              break;
            case 2:
              currentState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
              targetState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
              break;
            case 3:
              currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
              targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              break;
            case 4:
              currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
              targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              break;
            case 5:
              if(status.sp > status.t) {
                currentState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
                targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              } else if (status.sp < status.t) {
                currentState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
                targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              } else {
                currentState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
                targetState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              }
              break;
          }

          this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, currentState);
          this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, targetState);
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, status.t);
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed,
            this.convertRotationSpeedFromInnovaToHomeKit(status.fs));

          this.service.updateCharacteristic(this.platform.Characteristic.SwingMode,
            // eslint-disable-next-line max-len
            (status.fr === 0 ? this.platform.Characteristic.SwingMode.SWING_ENABLED : this.platform.Characteristic.SwingMode.SWING_DISABLED),
          );

          this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, Math.in(Math.max(status.sp, 16), 31));
          this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, Math.in(Math.max(status.sp, 16), 31));
        }
      });

    }, 5000);
  }

  async setActive(value: CharacteristicValue) {
    let endpoint;
    if(value === this.platform.Characteristic.Active.ACTIVE) {
      endpoint = 'on';
    } else {
      endpoint = 'off';
    }
    this.updateDevice('power/' + endpoint);
    this.platform.log.debug('Set Characteristic Active ->', value);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    let endpoint;
    if(value === this.platform.Characteristic.TargetHeaterCoolerState.COOL) {
      endpoint = 'cooling';
    } else if(value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
      endpoint = 'heating';
    } else if(value === this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      endpoint = 'auto';
    }

    this.updateDevice('set/mode/' + endpoint);

    this.platform.log.debug('Set Characteristic TargetHeaterCoolerState ->', value);
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.debug('Set Characteristic RotationSpeed ->', value);

    if (value === 0) {
      this.updateDevice('power/off');

      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.platform.Characteristic.Active.INACTIVE,
      );

    } else {
      const param = this.convertRotationSpeedFromHomeKitToInnova(value);
      this.updateDevice('set/fan', { 'value': param });
      this.platform.log.debug('Set Characteristic RotationSpeed -> ', value);

    }
  }

  convertRotationSpeedFromInnovaToHomeKit(value) {
    const _rotationStops = {
      3: 75,
      2: 50,
      1: 25,
      0: 100,
    };
    return _rotationStops[value];
  }

  convertRotationSpeedFromHomeKitToInnova(value) {
    const _rotationSteps = [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0,
    ];
    return _rotationSteps[value];
  }

  async setSwingMode(value: CharacteristicValue) {
    let param;
    if(value === this.platform.Characteristic.SwingMode.SWING_ENABLED) {
      param = 0;
    } else {
      param = 7;
    }
    this.updateDevice('set/feature/rotation', { 'value': param });
    this.platform.log.debug('Set Characteristic SwingMode ->', value);
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.updateDevice('set/setpoint', { 'p_temp': value });
    this.platform.log.debug('Set Characteristic CoolingThresholdTemperature ->', value);

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .getValue((status, targetHeaterCoolerValue) => {
        if(targetHeaterCoolerValue ===
          this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
          this.platform.log.debug('Auto setting Heating Threshold ->', value);
          this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, value);
        }
      });
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.updateDevice('set/setpoint', { 'p_temp': value });
    this.platform.log.debug('Set Characteristic HeatingThresholdTemperature ->', value);

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .getValue((status, targetHeaterCoolerValue) => {
        if(targetHeaterCoolerValue ===
          this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
          this.platform.log.debug('Auto setting Cooling Threshold ->', value);
          this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, value);
        }
      });
  }

  async getDeviceStatus() {
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/status`;
    this.platform.log.debug('Getting status -> ' + url);

    try {
      const response = await axios({method: 'GET', url: url, timeout: 10000});
      if (response.status === 200) {
        const status = await response.data;
        if (status && Object.prototype.hasOwnProperty.call(status, 'RESULT') && status.RESULT) {
          const deviceStatus: DeviceStatus = status.RESULT;
          return deviceStatus;
        } else {
          this.platform.log.debug('Error reading status ' + status);
        }
      }
    } catch (e) {
      this.platform.log.error('Exception ' + e);
    }
    this.platform.log.error('Error reaching device ' + url);
  }

  updateDevice(endpoint, params = {}) {
    const query = Object.keys(params).map(x => `${x}=${params[x]}`).join('&');
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/${endpoint}?${query}`;

    this.platform.log.info('Updating Device -> ' + url);

    axios({method: 'POST', url: url, timeout: 10000}).then(r => {
      this.platform.log.info('Updated Device -> ' + url + ' response -> ' + r.status);
    }).catch(e => {
      this.platform.log.error('Exception ' + e + ' No response during device update ' + url );
    });

  }

}
