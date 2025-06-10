import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {HomebridgePowrmatic} from './platform';
import axios from 'axios';

interface DeviceStatus {
  ps: number;
  sp: number;
  fr: number;
  fs: number;
  wm: number;
  t: number;
}

export class PowrmaticAirConditioner {
  private service: Service;

  private state = {
    active: false,
    targetHeaterCoolerState: 2,
    rotationSpeed: 0,
    swingMode: this.platform.Characteristic.SwingMode.SWING_DISABLED,
    coolingThresholdTemperature: 22,
    heatingThresholdTemperature: 22,
    currentTemperature: 22,
    currentHeaterCoolerState: this.platform.Characteristic.CurrentHeaterCoolerState.IDLE,
  };

  constructor(
    private readonly platform: HomebridgePowrmatic,
    private readonly accessory: PlatformAccessory,
  ) {

    this.platform.log.info(`Initializing accessory: ${accessory.displayName}`);
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Powrmatic')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.service = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);

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

    setInterval(() => {
      this.platform.log.debug(`[${this.accessory.displayName}] Updating HomeKit`);

      this.getDeviceStatus().then((status) => {
        if(status) {
          this.platform.log.debug(`[${this.accessory.displayName}] Received device status:`, status);
          this.state.active = status.ps === 1;
          this.service.updateCharacteristic(this.platform.Characteristic.Active,
            (this.state.active ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE),
          );

          switch (status.wm) {
            case 0: // Innova manual heat
              this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
              this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
              break;
            case 1: // Innova manual cool
              this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
              this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.COOL;
              break;
            case 2: // Innova manual dry
              this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
              this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              break;
            case 3: // Innova manual fan only
              this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
              this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              break;
            case 4: // Innova auto
              if(status.sp > status.t) {
                this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
                this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              } else if (status.sp < status.t) {
                this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
                this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              } else {
                this.state.currentHeaterCoolerState = this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
                this.state.targetHeaterCoolerState = this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
              }
              break;
          }

          this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.state.currentHeaterCoolerState);
          this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.state.targetHeaterCoolerState);
          this.state.currentTemperature = status.t;
          this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.state.currentTemperature);
          this.state.rotationSpeed = this.convertRotationSpeedFromInnovaToHomeKit(status.fs);
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.rotationSpeed);

          this.state.swingMode = (status.fr === 0 ? this.platform.Characteristic.SwingMode.SWING_ENABLED :
            this.platform.Characteristic.SwingMode.SWING_DISABLED);
          this.service.updateCharacteristic(this.platform.Characteristic.SwingMode,
            this.state.swingMode,
          );
          const setPoint = Math.min(Math.max(status.sp, 16), 31);
          this.state.coolingThresholdTemperature = setPoint;
          this.state.heatingThresholdTemperature = setPoint;

          this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature,
            this.state.coolingThresholdTemperature);
          this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature,
            this.state.heatingThresholdTemperature);

          this.platform.log.debug(`[${this.accessory.displayName}] Updated HomeKit state:`, this.state);
        } else {
          this.platform.log.warn(`[${this.accessory.displayName}] Failed to get device status.`);
        }
      });

    }, 5000);
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.info(`[${this.accessory.displayName}] Set Active -> ${value}`);
    let endpoint;
    if(value === this.platform.Characteristic.Active.ACTIVE) {
      endpoint = 'on';
    } else {
      endpoint = 'off';
    }
    await this.updateDevice('power/' + endpoint);
    this.state.active = value as boolean;
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.info(`[${this.accessory.displayName}] Set TargetHeaterCoolerState -> ${value}`);
    let endpoint;
    if(value === this.platform.Characteristic.TargetHeaterCoolerState.COOL) {
      endpoint = 'cooling';
    } else if(value === this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
      endpoint = 'heating';
    } else if(value === this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      endpoint = 'auto';
    } else {
      this.platform.log.warn(`[${this.accessory.displayName}] Unsupported TargetHeaterCoolerState: ${value}`);
      return;
    }

    await this.updateDevice('set/mode/' + endpoint);
    this.state.targetHeaterCoolerState = value as number;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.info(`[${this.accessory.displayName}] Set RotationSpeed -> ${value}`);

    if (value === 0) {
      await this.updateDevice('power/off');
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.platform.Characteristic.Active.INACTIVE,
      );
      this.state.active = false;
      this.state.rotationSpeed = 0;
    } else {
      const param = this.convertRotationSpeedFromHomeKitToInnova(value);
      await this.updateDevice('set/fan', { 'value': param });
      this.state.rotationSpeed = value as number;
      if (!this.state.active) {
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE);
        this.state.active = true;
      }
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
    this.platform.log.info(`[${this.accessory.displayName}] Set SwingMode -> ${value}`);
    let param;
    if(value === this.platform.Characteristic.SwingMode.SWING_ENABLED) {
      param = 0;
    } else {
      param = 7;
    }
    await this.updateDevice('set/feature/rotation', { 'value': param });
    this.state.swingMode = value as number;
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.info(`[${this.accessory.displayName}] Set CoolingThresholdTemperature -> ${value}`);
    await this.updateDevice('set/setpoint', { 'sp': value });
    this.state.coolingThresholdTemperature = value as number;
    if (this.state.targetHeaterCoolerState === this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      this.platform.log.debug(`[${this.accessory.displayName}] Auto setting Heating Threshold -> ${value}`);
      this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, value);
      this.state.heatingThresholdTemperature = value as number;
    }
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    this.platform.log.info(`[${this.accessory.displayName}] Set HeatingThresholdTemperature -> ${value}`);
    await this.updateDevice('set/setpoint', { 'sp': value });
    this.state.heatingThresholdTemperature = value as number;
    if (this.state.targetHeaterCoolerState === this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
      this.platform.log.debug(`[${this.accessory.displayName}] Auto setting Cooling Threshold -> ${value}`);
      this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, value);
      this.state.coolingThresholdTemperature = value as number;
    }
  }

  async getDeviceStatus() {
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/status`;
    this.platform.log.debug(`[${this.accessory.displayName}] Getting device status from ${url}`);
    try {
      const response = await axios.get(url, { timeout: 5000 });
      this.platform.log.debug(`[${this.accessory.displayName}] Device status response:`, response.data);
      if (response.data && response.data.success && response.data.RESULT) {
        return response.data.RESULT as DeviceStatus;
      } else {
        this.platform.log.warn(`[${this.accessory.displayName}] Failed to get device status. Response:`,
          response.data);
        return null;
      }
    } catch (error) {
      this.platform.log.error(`[${this.accessory.displayName}] Error getting device status: ${error}`);
      return null;
    }
  }

  async updateDevice(endpoint: string, params = {}) {
    const url = `http://${this.accessory.context.device.ipAddress}/api/v/1/${endpoint}`;
    this.platform.log.info(`[${this.accessory.displayName}] Updating device at ${url} with params:`, params);
    try {
      const response = await axios.post(url, params, { timeout: 5000 });
      this.platform.log.debug(`[${this.accessory.displayName}] Device update response:`, response.data);
      if (!response.data || !response.data.success) {
        this.platform.log.error(`[${this.accessory.displayName}] Failed to update device. Response:`,
          response.data);
      }
    } catch (error) {
      this.platform.log.error(`[${this.accessory.displayName}] Error updating device: ${error}`);
    }
  }

}
