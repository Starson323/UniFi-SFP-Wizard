# Firmware 1.1.8 — Profile Store and Restore APIs

Notes from comparing the strings in the official v1.1.3 and v1.1.8 firmware images. Request and
response layouts below are **inferred** from log messages and format strings, not confirmed on a
device yet. Confirm them with the API Console before building features on them.

## Getting the images

```
https://fw-update.ui.com/api/firmware?filter=eq~~product~~SFP-Wizard&filter=eq~~channel~~release
```

Do not filter on `platform` (the firmware reports `USFPDA27`, and filtering on `ESP32` returns
nothing). Each entry has `_links.data.href` and `sha256_checksum`.

| Version | Released   | Image |
|---------|------------|-------|
| v1.1.3  | 2026-01-08 | `0a72-USFPDA27-1.1.3-09517f48-f450-426e-a3ae-5e18d4f0adf3.bin` |
| v1.1.8  | 2026-10-05 | `2ed8-USFPDA27-1.1.8-a47b8b76-4729-40cc-9b7e-eca0d4736461.bin` |

The images are plain (unencrypted) ESP32 app images, so their strings are readable.

## Profile Store ("favorites")

The on-device "SFP Profile Store" is called *favorites* internally. None of these exist in 1.1.3.
Paths are relative to `/api/1.0/{mac}`. Profiles are stored as
`/fs/favorites/{sfp|qsfp}/{partNumber}/{sn}.bin`.

### Confirmed on a device (v1.1.8, 2026-10-19)

```
GET /xsfp/favorites/start
-> {"chunk": 640, "props": [{"type": "sfp", "partNumber": "SFP-GE-TA-C", "sn": "TA1711100020", "size": 512}]}

GET /xsfp/favorites/data  {"index": 0, "offset": 0, "chunk": 512}
-> 512 raw EEPROM bytes (binary body), same layout as a .uieeprom file, checksums valid

GET /xsfp/recover/records/start
-> {"size": 7610, "chunk": 2048}

GET /xsfp/recover/records/data  {"offset": 0, "chunk": 2048}
-> binary body holding one JSON document, split across chunks (offset 0, 2048, 4096, 6144):
   {"records": [{"partNumber": "OM-MM-1G-D", "vendor": "BM", "product": 2, "wavelengths": [850]}, ...]}
```

The restore records are a catalogue of **Ubiquiti** modules the Wizard can restore to factory
(`OM-*`, `UF-*`, `OM-SFP28-*`, `OM-QS...`), about 95 entries. `vendor` is a two-letter
manufacturer code (BM, AX, FT, CV, AH) and the same part number appears once per manufacturer.
Third-party modules are not in it.

### Inferred, not yet confirmed

| Request | Inferred behaviour |
|---|---|
| `GET /xsfp/favorites/start` | Lists stored profiles. Logs `Reading %s pn:%s sn:%s, size:%d` and `Append sfp %s@%s` per entry. |
| `GET /xsfp/favorites/data` `{index, offset, chunk}` | Reads stored profile `index` in chunks. Errors: `Index %d out of range (max %d)`, `Requested range exceeds capacity/size`. |
| `POST /xsfp/favorites/start` | Starts an upload. Fails with `Too many item is the fav list %d/%d` when the store is full. |
| `POST /xsfp/favorites/data` | Upload bytes. Logs `index:%d, received %d/%d`; rejects invalid SFP/QSFP snapshots and wrong sizes. |
| `POST /xsfp/favorites/cancel` | Aborts an upload. |
| `POST /xsfp/favorites/erase` | Removes a profile (probably by `index`). |
| `POST /xsfp/favorites/capacity` | Unknown: may read **or set** capacity. Do not probe blindly. |

JSON keys found next to these handlers: `index`, `offset`, `chunk`, `size`, `sizes`,
`capacities`, `props`, `partNumberLegacy`, `wavelength`, `product`. Array formats such as
`"sizes":[%d,%d]` and `"sizes":[%d]` suggest one size per module type (SFP 512, QSFP 640).

Device UI strings: `Profile Store`, `Copy & Save Profile`, `Apply Stored Profile`,
`Pick Stored Profile`, `Remove Profile?`, `Store is Full`, `Already Stored`, `No Stored Profile`.

## Restore ("recover")

Restores modules from built-in "golden" snapshots, looked up by part number (`Trying to find
legacy pn`, `Trying to find actual pn`) or serial (`Golden snapshot ... not found for sn`).

| Request | Notes |
|---|---|
| `GET /xsfp/recover/records/start`, `GET .../records/data`, `POST .../records/cancel` | List restore records (`records-len: %d`). |
| `POST /xsfp/recover/bundle`, `POST /xsfp/recover/sn` | Perform a restore. Writes to the module. |
| `POST /xsfp/recover` | Already present in 1.1.3. |

## Other endpoints in 1.1.8

`/ddm/start`, `/ddm/data`, `/ddm/valid` (live DDM readings), `/fw/start|data|abort`,
`/sif/start|data|info|abort`, `/api/1.0/version`, `/api/version`.
