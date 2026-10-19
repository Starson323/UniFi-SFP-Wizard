/**
 * Identity fields of an SFP/QSFP EEPROM (SFF-8472 page A0h layout).
 */
export interface EepromIdentity {
    vendor: string;
    part: string;
    sn: string;
}

/**
 * A module type: the SFF-8472 page A0h bytes that describe speed, media and reach.
 * Values follow SFF-8472 / SFF-8024 and were checked against real module dumps in /repository.
 */
export interface TypePreset {
    id: string;
    speed: string;                  // Group shown in the type list, e.g. "10G (SFP+)"
    label: string;
    help: string;                   // Plain-English description: media, connector, reach, typical use
    connector: number;              // Byte 2 (SFF-8024 Table 4-3)
    compliance: { [byte: number]: number }; // Bytes 3-10 transceiver codes
    extended: number;               // Byte 36 extended compliance (SFF-8024 Table 4-4)
    encoding: number;               // Byte 11
    bitrate: number;                // Byte 12, units of 100 MBd (0xFF = see byte 66)
    bitrate250: number;             // Byte 66 when byte 12 is 0xFF, units of 250 MBd
    lengths: number[];              // Bytes 14-19: SMF km, SMF 100 m, OM2 10 m, OM1 10 m, OM4/copper, OM3 10 m
    wavelength: number;             // Bytes 60-61 in nm (0 for copper)
    cable?: boolean;                // Direct attach cable: byte 18 is the cable length in metres
}

// Byte offsets of the identity fields in page A0h.
const VENDOR = [20, 16], OUI = [37, 3], PART = [40, 16], REV = [56, 4], SN = [68, 16], DATE = [84, 8];

export class Eeprom {
    // .uieeprom size for SFP/SFP+/SFP28: page A0h (256 bytes) followed by page A2h (256 bytes).
    public static readonly SFP_SIZE = 512;

    public static readonly types: TypePreset[] = [
        {id: "1g-sx", speed: "1G (SFP)", label: "SX: short range fibre, 850 nm", help: "Multimode fibre (OM1 to OM4) with an LC duplex connector, up to 550 m. For short fibre runs within a building.", connector: 0x07, compliance: {6: 0x01}, extended: 0x00, encoding: 0x01, bitrate: 0x0D, bitrate250: 0, lengths: [0, 0, 0x37, 0x1B, 0, 0], wavelength: 850},
        {id: "1g-lx", speed: "1G (SFP)", label: "LX: long range fibre, 1310 nm", help: "Single-mode fibre (OS1/OS2) with an LC duplex connector, up to 10 km. For links between buildings or longer runs.", connector: 0x07, compliance: {6: 0x02}, extended: 0x00, encoding: 0x01, bitrate: 0x0D, bitrate250: 0, lengths: [0x0A, 0x64, 0, 0, 0, 0], wavelength: 1310},
        {id: "1g-t", speed: "1G (SFP)", label: "Copper RJ45: 1000BASE-T", help: "An ordinary Cat5e or Cat6 network cable plugs into the module, up to 100 m. No fibre involved.", connector: 0x22, compliance: {6: 0x08}, extended: 0x00, encoding: 0x01, bitrate: 0x0D, bitrate250: 0, lengths: [0, 0, 0, 0, 0x64, 0], wavelength: 0},
        {id: "10g-sr", speed: "10G (SFP+)", label: "SR: short range fibre, 850 nm", help: "Multimode fibre with an LC duplex connector, up to 300 m on OM3 or 400 m on OM4. The usual 10G fibre module within a building or rack.", connector: 0x07, compliance: {3: 0x10}, extended: 0x00, encoding: 0x06, bitrate: 0x67, bitrate250: 0, lengths: [0, 0, 0x08, 0x02, 0x28, 0x1E], wavelength: 850},
        {id: "10g-lr", speed: "10G (SFP+)", label: "LR: long range fibre, 1310 nm", help: "Single-mode fibre with an LC duplex connector, up to 10 km.", connector: 0x07, compliance: {3: 0x20}, extended: 0x00, encoding: 0x06, bitrate: 0x67, bitrate250: 0, lengths: [0x0A, 0x64, 0, 0, 0, 0], wavelength: 1310},
        {id: "10g-er", speed: "10G (SFP+)", label: "ER: extended range fibre, 1550 nm", help: "Single-mode fibre with an LC duplex connector, up to 40 km.", connector: 0x07, compliance: {3: 0x80}, extended: 0x00, encoding: 0x06, bitrate: 0x67, bitrate250: 0, lengths: [0x28, 0xFF, 0, 0, 0, 0], wavelength: 1550},
        {id: "10g-t", speed: "10G (SFP+)", label: "Copper RJ45: 10GBASE-T", help: "A Cat6a or Cat7 network cable plugs into the module, up to 30 m. These modules run hot and draw more power than fibre.", connector: 0x22, compliance: {}, extended: 0x16, encoding: 0x06, bitrate: 0x67, bitrate250: 0, lengths: [0, 0, 0, 0, 0x1E, 0], wavelength: 0},
        {id: "10g-dac", speed: "10G (SFP+)", label: "DAC: direct attach copper cable", help: "A fixed copper cable with an SFP+ plug on each end, usually 1 to 7 m. For short links within a rack. Set the cable length.", connector: 0x21, compliance: {8: 0x04}, extended: 0x00, encoding: 0x06, bitrate: 0x67, bitrate250: 0, lengths: [0, 0, 0, 0, 1, 0], wavelength: 0, cable: true},
        {id: "25g-sr", speed: "25G (SFP28)", label: "SR: short range fibre, 850 nm", help: "Multimode fibre with an LC duplex connector, up to 70 m on OM3 or 100 m on OM4.", connector: 0x07, compliance: {}, extended: 0x02, encoding: 0x06, bitrate: 0xFF, bitrate250: 0x67, lengths: [0, 0, 0, 0, 0x0A, 0x07], wavelength: 850},
        {id: "25g-lr", speed: "25G (SFP28)", label: "LR: long range fibre, 1310 nm", help: "Single-mode fibre with an LC duplex connector, up to 10 km.", connector: 0x07, compliance: {}, extended: 0x03, encoding: 0x06, bitrate: 0xFF, bitrate250: 0x67, lengths: [0x0A, 0x64, 0, 0, 0, 0], wavelength: 1310},
    ];

    /**
     * Decodes vendor name, part number and serial number from raw EEPROM bytes.
     *
     * @param {Uint8Array} data - The raw EEPROM data.
     * @return {EepromIdentity} The identity, with "-" for every field if the data is too short.
     */
    public static identity(data: Uint8Array): EepromIdentity {
        if (data.length < 96) {
            return {vendor: "-", sn: "-", part: "-"};
        }

        return {
            vendor: Eeprom.getString(data, VENDOR),
            part: Eeprom.getString(data, PART),
            sn: Eeprom.getString(data, SN)
        };
    }

    /**
     * Reads every editable identity field, for filling the builder form from a template.
     */
    public static fields(data: Uint8Array) {
        return {
            vendor: Eeprom.getString(data, VENDOR),
            oui: Array.from(data.slice(OUI[0], OUI[0] + OUI[1])).map(b => b.toString(16).padStart(2, "0")).join(":").toUpperCase(),
            part: Eeprom.getString(data, PART),
            rev: Eeprom.getString(data, REV),
            sn: Eeprom.getString(data, SN),
            date: Eeprom.getString(data, DATE)
        };
    }

    /**
     * Creates an empty SFP profile: identifier SFP, no DDM, standard TX_DISABLE/TX_FAULT/LOS options.
     */
    public static blank(): Uint8Array<ArrayBuffer> {
        const data = new Uint8Array(Eeprom.SFP_SIZE);

        data[0] = 0x03;  // Identifier: SFP/SFP+/SFP28
        data[1] = 0x04;  // Extended identifier: two-wire ID only
        data[65] = 0x1A; // Options: TX_DISABLE, TX_FAULT, LOS

        return data;
    }

    /**
     * Applies a module type, replacing every speed/media/reach byte and leaving everything else.
     *
     * @param {Uint8Array} data - The profile to modify in place.
     * @param {TypePreset} type - The module type.
     * @param {number} cableLength - Cable length in metres, used by direct attach cables.
     */
    public static applyType(data: Uint8Array, type: TypePreset, cableLength: number = 1): void {
        data[2] = type.connector;
        data.fill(0, 3, 11);
        Object.entries(type.compliance).forEach(([byte, value]) => data[Number(byte)] = value);
        data[11] = type.encoding;
        data[12] = type.bitrate;
        data[13] = 0x00;
        data.set(type.lengths, 14);
        data[36] = type.extended;
        data[66] = type.bitrate250;
        data[67] = 0x00;

        if (type.cable) {
            data[18] = Math.max(1, Math.min(255, cableLength));

            // Bytes 60-61 hold cable compliance for direct attach cables: SFF-8431 Appendix E.
            data[60] = 0x01;
            data[61] = 0x00;
        } else {
            data[60] = (type.wavelength >> 8) & 0xFF;
            data[61] = type.wavelength & 0xFF;
        }
    }

    /**
     * Writes the identity fields. Strings are ASCII, space padded; the date code is YYMMDD plus a lot code.
     */
    public static setFields(data: Uint8Array, fields: { vendor: string, oui: string, part: string, rev: string, sn: string, date: string }): void {
        Eeprom.setString(data, VENDOR, fields.vendor);
        Eeprom.setString(data, PART, fields.part);
        Eeprom.setString(data, REV, fields.rev);
        Eeprom.setString(data, SN, fields.sn);
        Eeprom.setString(data, DATE, fields.date);

        const oui = Eeprom.parseOui(fields.oui);
        if (oui) data.set(oui, OUI[0]);
    }

    /**
     * Recalculates CC_BASE (byte 63) and CC_EXT (byte 95).
     */
    public static updateChecksums(data: Uint8Array): void {
        data[63] = Eeprom.sum(data, 0, 63);
        data[95] = Eeprom.sum(data, 64, 95);
    }

    public static checksumsValid(data: Uint8Array): boolean {
        return data.length >= 96 && data[63] === Eeprom.sum(data, 0, 63) && data[95] === Eeprom.sum(data, 64, 95);
    }

    /**
     * True if the vendor-specific area (bytes 96-127) holds data. Some switches (e.g. Cisco)
     * store a vendor ID and check value there that a builder cannot recreate.
     */
    public static hasVendorData(data: Uint8Array): boolean {
        return data.slice(96, 128).some(b => b !== 0x00 && b !== 0xFF);
    }

    /**
     * True if the profile advertises digital diagnostics (byte 92 bit 6), whose alarm
     * thresholds live in page A2h.
     */
    public static hasDiagnostics(data: Uint8Array): boolean {
        return (data[92] & 0x40) !== 0;
    }

    /**
     * Returns a short description of the type bytes, e.g. "10G, 1310 nm, LC, SMF 10 km".
     */
    public static describe(data: Uint8Array): string {
        const parts: string[] = [];
        const gbd = data[12] === 0xFF ? data[66] * 0.25 : data[12] * 0.1;

        if (gbd > 0) parts.push(gbd >= 20 ? "25G" : gbd >= 9 ? "10G" : gbd >= 1 ? "1G" : `${gbd.toFixed(1)} GBd`);

        const connector: { [key: number]: string } = {0x07: "LC", 0x21: "copper cable", 0x22: "RJ45"};
        if (connector[data[2]]) parts.push(connector[data[2]]);

        if (data[2] === 0x21) {
            parts.push(`${data[18]} m`);
        } else {
            const wavelength = (data[60] << 8) | data[61];
            if (wavelength > 0 && wavelength < 2000) parts.push(`${wavelength} nm`);
            if (data[14] > 0) parts.push(`SMF ${data[14]} km`);
            else if (data[19] > 0) parts.push(`OM3 ${data[19] * 10} m`);
            else if (data[16] > 0) parts.push(`OM2 ${data[16] * 10} m`);
            else if (data[18] > 0) parts.push(data[2] === 0x22 ? `${data[18]} m` : `OM4 ${data[18] * 10} m`);
        }

        return parts.join(", ");
    }

    /**
     * Renders bytes as a 16-bytes-per-row hex dump with an ASCII column.
     */
    public static hexDump(data: Uint8Array): string {
        const rows: string[] = [];

        for (let offset = 0; offset < data.length; offset += 16) {
            const row = data.slice(offset, offset + 16);
            const hex = Array.from(row).map(b => b.toString(16).padStart(2, "0")).join(" ");
            const ascii = Array.from(row).map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".").join("");

            rows.push(`${offset.toString(16).padStart(4, "0")}  ${hex.padEnd(47)}  ${ascii}`);
        }

        return rows.join("\n");
    }

    /**
     * Parses an OUI like "00:17:6A", "00-17-6A" or "00176a".
     *
     * @return {number[] | null} Three bytes, or null if invalid.
     */
    public static parseOui(value: string): number[] | null {
        const hex = value.replace(/[\s:-]/g, "");

        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

        return [0, 2, 4].map(i => parseInt(hex.substring(i, i + 2), 16));
    }

    /**
     * True if a string only uses printable ASCII, which is all an EEPROM text field may contain.
     */
    public static isAscii(value: string): boolean {
        return /^[\x20-\x7E]*$/.test(value);
    }

    private static getString(data: Uint8Array, [offset, length]: number[]): string {
        return new TextDecoder().decode(data.slice(offset, offset + length)).replace(/[\x00\s]+$/, "");
    }

    private static setString(data: Uint8Array, [offset, length]: number[], value: string): void {
        for (let i = 0; i < length; i++) {
            data[offset + i] = i < value.length ? value.charCodeAt(i) & 0x7F : 0x20;
        }
    }

    private static sum(data: Uint8Array, from: number, to: number): number {
        let sum = 0;

        for (let i = from; i < to; i++) sum += data[i];

        return sum & 0xFF;
    }
}
