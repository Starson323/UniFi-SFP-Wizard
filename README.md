# UniFi SFP Wizard Web App

A browser-based tool for the Ubiquiti UniFi SFP Wizard (UACC-SFP-Wizard). It connects to the
Wizard over Bluetooth and lets you read, back up and write SFP/QSFP module EEPROMs, and manage
the profiles stored on the Wizard itself.

This is a fork of [Gamer08YT/UniFi-SFP-Wizard](https://github.com/Gamer08YT/UniFi-SFP-Wizard),
focused on Wizard firmware 1.1.8 and newer.

![Dashboard](/assets/img/dashboard.png)

## Use it

**Web app:** https://starson323.github.io/UniFi-SFP-Wizard/

Add `?classic` to the URL for the classic Bootstrap theme.

### Browser requirements

The app uses the Web Bluetooth API, which means:

- **Supported:** Chrome, Edge and other Chromium browsers on Windows, macOS, Linux and Android.
- **Not supported:** Firefox, and Safari on macOS and iOS.
- The page must be opened over **HTTPS** or on **localhost**. Browsers disable Bluetooth on plain
  `http://` addresses (for example `http://192.168.1.10:8080`), and the app tells you if that is
  the problem.

## Features

### Device

- Device info: name, serial, firmware version, battery level
- Rename, reboot, shut down
- Charge control
- Download the Wizard's internal syslog

### Modules

- Read module details (part number, vendor, serial, type, compliance)
- **Save:** download the module's EEPROM as a `.uieeprom` file and keep a copy in My Backups
- **Write:** send an EEPROM to the Wizard from one of three sources:
  - **Local File:** a `.uieeprom` file from your computer
  - **Repository:** community profiles from the [`repository`](repository) folder
  - **My Backups:** any module previously saved in this browser
- Writing requires a backup of the inserted module first (see below)

### Profile Store (firmware 1.1.8+)

Firmware 1.1.8 lets the Wizard store module profiles on the device ("SFP Profile Store" on the
Wizard's screen). The app can:

- List the profiles stored on the Wizard
- Download any stored profile as a `.uieeprom` file
- Copy a stored profile into My Backups

Uploading and deleting stored profiles from the app is in progress.

### API Console (advanced)

A raw request console for exploring the Wizard's Bluetooth API. It includes read-only presets
for the newer firmware endpoints, asks for confirmation before any POST request, and can
download a session log of every request and response. See
[doc/FIRMWARE_1.1.8.md](doc/FIRMWARE_1.1.8.md) for what is known about the 1.1.8 API.

## Module Backups (Required Before Writing)

**The app will not let you write a new EEPROM to a module until a backup of that module's
current contents exists.**

Writing overwrites the module's vendor name, serial number and part number. If you have no copy
of the original and it is not printed on the module, that information is gone for good.

How it works:

1. Click **Read** to fetch the inserted module's identity.
2. Click **Save**. This downloads a `.uieeprom` file and stores a copy in My Backups.
3. **Write** only goes ahead if a backup exists for that exact serial number. Clicking Write
   re-reads the inserted module first, so the check always applies to the module in the slot.

### My Backups

My Backups is a searchable list of every module this browser has saved, stored in the browser's
IndexedDB. Search by serial number, part number or vendor.

**Limitation:** backups stay in the browser and device that made them. A backup saved on your
phone is not visible on your laptop. Download the `.uieeprom` files (or use the Profile Store)
if you need copies elsewhere.

## Run Locally

Requires [Node.js](https://nodejs.org/) 20 or newer.

```
npm ci
npm run serve
```

Then open http://localhost:8080 in Chrome or Edge.

| Command | Purpose |
|---|---|
| `npm run serve` | Development server with live reload on port 8080 |
| `npm run build` | Production build into `dist/` |
| `npm start` | Run the Electron desktop app |
| `npm run make` | Build desktop installers (MSIX, DEB, DMG) with Electron Forge |

There are no prebuilt desktop releases for this fork yet. The GitHub Pages site is deployed
automatically from `master`.

## Known Issues

### Writing needs confirmation on the Wizard

The Wizard's API does not flash a module directly. **Write** sends the EEPROM into the Wizard's
snapshot buffer, and you then confirm the flash on the Wizard itself.

### Module can't be read after power-on

If the Wizard is powered on with a module already inserted, the module can't be read. Remove it
and plug it in again.

### Random reboots

The Wizard occasionally reboots on its own. This also happens with the official app, so it
appears to be a firmware issue. If the Wizard stops responding, the app times out after 10
seconds instead of hanging.

### Some modules can't be flashed

Firmware newer than 1.0.5 only flashes modules whose part number is in the Wizard's built-in
password database, which is used to unlock write-protected modules. That database only contains
**Ubiquiti-branded** modules and cables, so it does not help with third-party modules. Generic
donor modules are usually not write-protected in the first place.
[sfpw-tool's downgrade notes](https://github.com/vitaminmoo/sfpw-tool/blob/main/doc/HOW_TO_DOWNGRADE_AND_WHY_NOT_TO.md)
explain why older firmware is not a safe workaround.

## Contributing

Issues and pull requests are welcome.

### EEPROM profiles

To contribute a profile, add the `.uieeprom` file to the [`repository`](repository) folder, add an
entry to [`repository/dumps.json`](repository/dumps.json), and open a pull request.

## Credits

- [Jan Heil (Gamer08YT)](https://github.com/Gamer08YT/UniFi-SFP-Wizard), the original author of
  this tool
- [posi211](https://github.com/posi211/UniFi-SFP-Wizard), the Backup Library and backup-before-write
  safeguard
- [vitaminmoo/sfpw-tool](https://github.com/vitaminmoo/sfpw-tool), whose reverse engineering of
  the Wizard's Bluetooth protocol this project builds on
- Profile contributors listed in [`repository/dumps.json`](repository/dumps.json)

Built with TypeScript, Bootstrap 5, Web Bluetooth, jQuery, Electron, Electron Forge, Webpack,
i18next, Pako, Notiflix and js-untar. See [`package.json`](package.json) for versions.

## Disclaimer

**Use at your own risk.** Writing EEPROMs can make modules unusable. No liability is accepted for
damage, data loss or other problems.

This project is not affiliated with Ubiquiti or UniFi.

The EEPROM dumps in this repository are provided for testing purposes. For legal concerns about
the dumps or product images, please open an issue and the content will be removed.
