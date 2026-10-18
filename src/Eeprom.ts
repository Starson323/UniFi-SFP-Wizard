/**
 * Identity fields of an SFP/QSFP EEPROM (SFF-8472 page A0h layout).
 */
export interface EepromIdentity {
    vendor: string;
    part: string;
    sn: string;
}

export class Eeprom {
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

        const decoder = new TextDecoder();

        return {
            vendor: decoder.decode(data.slice(20, 36)).trim(),
            part: decoder.decode(data.slice(40, 56)).trim(),
            sn: decoder.decode(data.slice(68, 84)).trim()
        };
    }
}
