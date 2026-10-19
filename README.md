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

- **Device:** info (name, serial, firmware, battery), rename, reboot, shut down, charge control
  and syslog download
- **Modules:** read, back up (Save) and write SFP/QSFP EEPROMs, with a mandatory backup before
  any write
- **Write sources:** a local file, the community Repository, My Backups, or the SFP Builder
- **Profile Store (firmware 1.1.8+):** list and download the profiles stored on the Wizard
- **SFP Builder:** build SFP, SFP+ and SFP28 profiles from scratch or from a template
- **API Console:** send raw requests to the Wizard for exploring its API

## How to Use

### Connect

1. Turn the Wizard on. Close the official app on your phone first, because the Wizard accepts
   only one Bluetooth connection at a time.
2. Open the web app in Chrome or Edge and click **Connect**.
3. Pick the Wizard in the browser's Bluetooth list (it usually shows as "Sfp Wizard").
4. Once connected, the Wizard's name, serial, firmware version and battery level appear under the
   picture, and the other buttons become available. **Connect** changes to **Disconnect**.

### Device controls

| Button | What it does |
|---|---|
| **Shutdown** | Turns the Wizard off, after asking you to confirm. |
| **Reboot** | Restarts the Wizard, after asking you to confirm. The connection drops, so click Connect again afterwards. |
| **Charge Control** (under More) | Stops the Wizard charging from USB, after asking you to confirm. |
| **Change Name** (under More) | Renames the Wizard (up to 28 characters). This is the name shown in the Bluetooth list. |
| **Internal Logs** (under More) | Downloads the Wizard's internal syslog as `sif.log`. Useful for troubleshooting or reporting a problem. |

### Read a module

1. Insert the SFP or QSFP module into the Wizard.
2. Click **Read** in the Module Meta card.
3. The part number, revision, vendor, serial number, type and compliance (e.g. 10G BASE-LR) are
   shown.

If reading fails, unplug the module and plug it back in. A module that was already inserted
when the Wizard was switched on can't be read until it has been reinserted.

### Back up a module (Save)

Click **Save** in the Module Flash card. The app reads the module's full EEPROM, downloads it as
a `.uieeprom` file named after the vendor and part number, and stores a copy in My Backups.

Always do this before writing to a module. Writing overwrites the module's vendor name, serial
number and part number, and if you have no copy of the original (and it is not printed on the
module), that information is gone for good.

### Write a module

1. Insert the module you want to write to.
2. **Back it up first:** click **Save** (see above). The app will not write to a module unless a
   backup exists for that module's serial number.
3. Choose where the new profile comes from, using the buttons at the top of Module Flash:
   - **Local File:** pick a `.uieeprom` file from your computer.
   - **Repository:** pick a community profile from the list.
   - **My Backups:** pick a module saved earlier in this browser, for example to restore a module
     to its original identity.
   - **SFP Builder:** uses the profile you sent over with **Use for Write** in the SFP Builder.
4. Click **Write**. The app re-reads the inserted module, checks that a backup exists for it, and
   sends the profile to the Wizard.
5. **Confirm on the Wizard:** the app only loads the profile into the Wizard. To flash it, choose
   **Write** on the Wizard's own screen.
6. Click **Read** afterwards to check the module now reports the new identity.

### My Backups

My Backups is the list of every module this browser has saved, including profiles copied from
the Profile Store. Open it with the **My Backups** button in Module Flash, then type in the
search box to filter by serial number, part number or vendor.

Backups are stored in the browser (IndexedDB) on the device that made them. A backup saved on
your phone is not visible on your laptop, and clearing the browser's site data deletes them.
Keep the downloaded `.uieeprom` files somewhere safe as well.

### Profile Store

Firmware 1.1.8 lets the Wizard keep module profiles on the device itself: on the Wizard, insert a
module and choose **Profile Store** to see them ("SFP Profile Store").

In the app:

1. Click **Load Profiles** in the Profile Store card. The profiles stored on the Wizard are listed
   with their type, part number, serial number and size.
2. Click **Download** next to a profile to save it as a `.uieeprom` file, or **Save to My
   Backups** to copy it into My Backups, where it can be used as a write source or an SFP Builder
   template.

Uploading profiles to the Wizard and deleting them from the app is in progress. For now, use the
Wizard's own **Copy & Save Profile** to add profiles.

### SFP Builder

Build an SFP, SFP+ or SFP28 profile without needing a dump of the exact module. It works without
a Wizard connected.

1. **Start from** a blank profile, a Repository profile or one of My Backups, or use **or load a
   file** to start from a `.uieeprom` file.
2. **Module type:** pick one from the list, grouped by speed:
   - 1G: SX, LX, copper RJ45 (1000BASE-T)
   - 10G: SR, LR, ER, copper RJ45 (10GBASE-T), DAC cable (set the cable length)
   - 25G: SR, LR

   A description under the list explains each one: fibre or cable, connector and reach. With a
   template, the default **Keep the template's type** leaves its type exactly as it is.
3. **Identity:** set the vendor name, OUI, part number, revision, serial number and date code.
   The vendor box suggests names exactly as genuine modules spell them, and **Generate** creates
   a random serial number.
4. Check the **Result** line and any warnings. **Preview** shows the bytes.
5. Click **Download** to save the `.uieeprom`, or **Use for Write** to make it the write source
   in Module Flash, then follow [Write a module](#write-a-module).

Example, a Fortinet 1G copper module: start from **Blank profile**, choose **Copper RJ45:
1000BASE-T**, set the vendor to `FORTINET` and the part number to `FN-TRAN-GC`, generate a serial
and click **Use for Write**.

Things to know:

- Checksums are recalculated automatically. Bytes the form does not cover are kept from the
  template.
- Some switches, Cisco in particular, verify vendor-specific data (bytes 96-127) that cannot be
  built from scratch. For those, start from a dump of a genuine module. The builder warns when
  a template's vendor data may no longer match the identity you set.
- A blank profile has no diagnostics (DDM), so the switch shows no optical power readings. A
  template with diagnostics written to a copper module shows meaningless power readings.
- QSFP profiles are not supported by the builder yet.

### API Console (advanced)

For exploring the Wizard's Bluetooth API. Normal use does not need it.

1. Connect to the Wizard.
2. Pick a **Preset** (all presets are read-only), or enter a method, path and JSON body yourself.
   Paths are relative to `/api/1.0/{mac}` unless they start with `/api/`.
3. Click **Send**. The response header and body appear below, with binary bodies shown as a hex
   dump. POST requests ask for confirmation first, because they can change or erase data on the
   Wizard.
4. Click **Download Session** to save every request and response as a JSON file.

See [doc/FIRMWARE_1.1.8.md](doc/FIRMWARE_1.1.8.md) for what is known about the API.

### Wizard Log

The Wizard Log card shows the raw messages exchanged with the Wizard, newest at the bottom. Turn
off **Autoscroll the Log** to stop it jumping to the newest entry while you read.

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

In the desktop app, **Connect** opens the app's own device picker instead of the browser's:
select the Wizard from the list and click **Yes**.

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
