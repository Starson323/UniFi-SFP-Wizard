# Changelog

All notable changes to this fork (`Starson323/UniFi-SFP-Wizard`) are documented here.

This version number tracks the **web app**, not the physical Wizard device's own firmware
version. They are separate and only coincidentally similar-looking right now.

## [1.6.0] - 2026-10-19

### Added

- **Live diagnostics (DDM)**: a new Diagnostics tab shows the inserted module's temperature,
  voltage, laser bias, TX power and RX power while DDM Info is open on the Wizard. Each reading
  shows its normal range, a green/amber/red state from the module's own alarm and warning
  limits, and a chart of recent values. Updates every 2 seconds, and the full report can be
  downloaded as CSV. Uses the Wizard's `/ddm/valid`, `/ddm/start` and `/ddm/data` endpoints,
  confirmed on a 1.1.8 device and documented in `doc/FIRMWARE_1.1.8.md`.
- API Console preset to read the DDM report.

### Fixed

- **"GATT operation already in progress"** when two requests overlapped, e.g. clicking Internal
  Logs while live diagnostics was polling. Every Bluetooth write now goes through one queue, and
  a multi-part message is always sent without other writes in between.
- Live diagnostics pauses when you leave the Diagnostics tab.

## [1.5.0] - 2026-10-19

### Changed

- **Redesigned interface**: the single long page is now split into tabs (Module, Profile Store,
  SFP Builder, Device, Advanced), with a sticky top bar showing the connection status, Wizard
  name, firmware and battery next to the Connect button.
- Module details and Wizard details are shown as tidy two-column lists.
- Buttons have consistent roles: solid blue for the main action, outlined for secondary actions,
  and red only for Shutdown.
- The SFP Builder is laid out in numbered steps with the result beside the form, and
  "Use for Write" now switches to the Module tab.
- New stylesheet with a single set of colour tokens, replacing the old one and its line-height
  workarounds. Works on phone screens: panels stack and the tabs scroll sideways.

### Removed

- The classic Bootstrap theme (`?classic`).
- The product photo, which was loaded from Ubiquiti's servers.

## [1.4.0] - 2026-10-19

### Added

- **SFP Builder**: build SFP, SFP+ and SFP28 profiles from a blank profile or a template
  (Repository, My Backups or a file). Choose a module type (1G SX/LX/copper, 10G SR/LR/ER/copper/
  DAC, 25G SR/LR), each with a plain description, set the vendor, OUI, part number, revision,
  serial and date code, and download the result or use it as a new "SFP Builder" write source.
  Checksums are recalculated and the builder warns about vendor-specific data and diagnostics
  that may not match. Type presets were checked against the genuine module dumps in
  `/repository`.

### Removed

- German translation, as it cannot be maintained in this fork. The app is English only.
- "Unofficial Community" footer link.

## [1.3.0] - 2026-10-19

### Added

- **Profile Store (Wizard firmware 1.1.8+)**: lists the profiles stored on the Wizard itself.
  Each one can be downloaded as a `.uieeprom` file or copied into My Backups.
- **API Console**: send raw requests to the Wizard, with read-only presets for the 1.1.8
  endpoints, a confirmation step before any POST, and a downloadable session log.
- `doc/FIRMWARE_1.1.8.md`: notes on the Profile Store ("favorites") and Restore ("recover")
  APIs found by comparing the 1.1.3 and 1.1.8 firmware, with the formats confirmed on a device.

### Fixed

- **Connecting to firmware 1.1.8 timed out**: the app now reads device info directly from the
  Info characteristic instead of waiting for a `getVer` reply, and disconnects cleanly if
  connecting fails instead of leaving the loading spinner up.
- **Repository profiles**: the list and the files are now both loaded from this fork through
  `raw.githubusercontent.com`. Previously the list came from the rate-limited GitHub API and the
  files from a different fork.
- Requests to the Wizard time out after 10 seconds instead of hanging forever.
- The syslog download no longer loops forever when the Wizard sends a bad chunk.
- Text from the device and from EEPROMs is escaped before it is added to the page.
- The 512-byte fallback when saving a module never applied because of a typo.
- Opening the app over plain HTTP now explains that Bluetooth needs HTTPS or localhost, instead
  of saying the browser does not support Bluetooth.
- Quieter logs: binary responses are summarised, and responses are no longer reported as
  failing to decompress.
- Overlapping text in the new cards caused by the theme's compact line height.

### Changed

- README, page footer and author details updated for this fork, with credit to the original
  project.
- Removed a link to a `vanilla.css` stylesheet that does not exist.

## [1.2.0] - 2026-07-29

### Added

- **Local Backup Library ("My Backups")**: a third EEPROM source alongside Local File and
  Repository, backed by IndexedDB. Every module Save now also stores a searchable local copy
  (by serial number, part number, or vendor), in addition to the usual file download. Works
  identically on desktop and mobile browsers.
- **Mandatory backup-before-write safeguard**: clicking Write now forces a fresh read of the
  currently-connected module and blocks the write entirely if no local backup exists for that
  module's serial number, with a clear on-screen message telling the user to Save first.
- **Local File / Repository / My Backups source toggle**: only one EEPROM source is active at
  a time now, instead of two overlapping controls.
- **New EEPROM profile**: IBM/Blade Network `BN-CKM-SP-SR` (10GBase-SR, 850nm, 300m), sourced
  from the `krusic22/SFP-Transceiver-Flashing` community dump collection, converted from a
  256-byte page-A0-only dump to the 512-byte `.uieeprom` format (A2 diagnostic page
  zero-padded; vendor ID data is intact, live DDM readings on a written module may not be
  accurate).

### Fixed

- **EEPROM Repository dropdown appearing empty**: previously called the GitHub REST API
  (`api.github.com/.../contents/repository`), which is rate-limited to 60 unauthenticated
  requests/hour per IP and failed completely silently with no error surfaced. Now reads
  `dumps.json` directly from `raw.githubusercontent.com`, which isn't subject to that limit,
  and shows a visible error if the fetch ever does fail.
- **Repository selection not actually loading any data**: selecting an entry in the EEPROM
  Repository dropdown previously did nothing; `checkEEPROMSelection()` and the write path only
  ever checked the local file input. Repository selections now correctly fetch and load the
  chosen `.uieeprom` file's bytes.
- **Washed-out, low-contrast text** on `<select>`/`<input>` elements in the non-classic
  ("Liquid Glass") theme: `style.css` had duplicate legacy rules referencing undefined CSS
  variables (`--primary-text`, `--secondary-color`, etc.) with `!important`, silently
  overriding the correct theme colors. Classic mode (`?classic`) was unaffected, since it never
  loads `style.css`.
- Stale placeholder option ("Todo") no longer lingers in the Repository dropdown once real
  entries load.

### Documentation

- Added a "Module Backups (Required Before Writing)" section explaining why backups are
  mandatory, how the Read → Save → Write flow works, and the Backup Library's one real
  limitation (it's per-browser/per-device, so a backup saved on your phone won't satisfy the
  write gate on your laptop and vice versa).
- Added a section explaining `vitaminmoo/sfpw-tool`'s firmware password database, what it
  actually covers (Ubiquiti-branded modules only), and why it isn't used for compatibility
  warnings in this project (the typical use case here is flashing generic, usually-unlocked
  donor modules with OEM identities, the opposite direction from what that database protects
  against).

## [1.1.0] and earlier

Inherited from [Gamer08YT/UniFi-SFP-Wizard](https://github.com/Gamer08YT/UniFi-SFP-Wizard), plus
this fork's earlier changes: dropdown labels reading from `dumps.json`'s `name` field, three
additional EEPROM profiles (two Cisco modules, one FS.com module), and `Repository.ts`'s
`baseUrl` pointed at this fork so the live GitHub Pages demo pulls from here instead of upstream.
