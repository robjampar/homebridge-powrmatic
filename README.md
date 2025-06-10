<p align="center">
<img src="https://raw.githubusercontent.com/robjampar/homebridge-powrmatic/master/res/icon.png" width="150">
</p>

# Homebridge Powrmatic

This is a Homebridge plugin for Powrmatic air conditioner units that use the Innova control system.

## Features

*   Turn on/off
*   Control mode (Heat, Cool, Auto)
*   Control fan speed
*   Control swing mode
*   Control temperature setpoint

## Installation

1.  Install Homebridge using the official instructions.
2.  Install this plugin using `npm install -g homebridge-powrmatic`.
3.  Update your configuration file. See `config.schema.json` for a sample.

## Configuration

Example `config.json` entry:

```json
"platforms": [
    {
        "platform": "HomebridgePowrmatic",
        "name": "Powrmatic",
        "devices": [
            {
                "ipAddress": "192.168.0.7",
                "displayName": "Living Room AC"
            }
        ]
    }
]
```

## Development

To develop this plugin:

1.  Clone the repository.
2.  Run `npm install` to install the dependencies.
3.  Run `npm run watch` to automatically compile and restart Homebridge when you make changes.

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

## Disclaimer

This plugin is not officially endorsed by Powrmatic or Innova. Use at your own risk.


