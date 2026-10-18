import $ from "jquery";
import i18next from "i18next";
import {Notify} from "notiflix";
import {ApiSender} from "./ApiConsole";
import {BackupStore} from "./BackupStore";
import {Eeprom} from "./Eeprom";

/**
 * One profile as listed by GET /xsfp/favorites/start.
 */
export interface StoredProfile {
    type: string;
    partNumber: string;
    sn: string;
    size: number;
}

/**
 * ProfileStore
 *
 * Read-only access to the Wizard's on-device "SFP Profile Store" (firmware 1.1.8+, called
 * "favorites" in the firmware). Confirmed on a device:
 *
 *   GET /xsfp/favorites/start                      -> {chunk, props: [{type, partNumber, sn, size}]}
 *   GET /xsfp/favorites/data {index, offset, chunk} -> raw EEPROM bytes
 *
 * Upload and erase (POST) are not implemented until their request formats are confirmed.
 */
export class ProfileStore {
    private profiles: StoredProfile[] = [];
    private chunk = 640;

    constructor(private readonly send: ApiSender, private readonly getMac: () => string, private readonly onBackupSaved: () => void) {
        $("#store-load").on("click", () => this.load());

        // Row buttons are re-rendered on every load, so delegate from the table.
        $("#store-table").on("click", "button[data-action]", (event) => {
            const button = $(event.currentTarget);
            const index = parseInt(button.attr("data-index") as string, 10);

            if (button.attr("data-action") === "download") {
                this.download(index);
            } else {
                this.saveToBackups(index);
            }
        });
    }

    /**
     * Clears the list, e.g. after a disconnect.
     *
     * @return {void} This method does not return a value.
     */
    public clear(): void {
        this.profiles = [];
        $("#store-table tbody").empty();
        $("#store-status").text("");
    }

    private path(endpoint: string): string {
        return `/api/1.0/${this.getMac()}${endpoint}`;
    }

    /**
     * Fetches the profile list from the Wizard and renders it.
     *
     * @return {Promise<void>} Resolves once the list is rendered.
     */
    private async load(): Promise<void> {
        try {
            const response = await this.send("GET", this.path("/xsfp/favorites/start"), {}, 10000);

            if (response.header?.statusCode != 200 || !Array.isArray(response.body?.props)) {
                Notify.failure(i18next.t("common:store-error"));
                return;
            }

            this.profiles = response.body.props;
            this.chunk = response.body.chunk || 640;
            this.render();
        } catch (e) {
            console.warn("Failed to list Profile Store.", e);
        }
    }

    private render(): void {
        const body = $("#store-table tbody").empty();

        this.profiles.forEach((profile, index) => {
            const row = $("<tr>");

            // Build via .text() so strings from the device can't inject HTML.
            [profile.type.toUpperCase(), profile.partNumber, profile.sn, `${profile.size} B`].forEach(value => {
                row.append($("<td>").text(value));
            });

            row.append($("<td class=\"text-end\">").append(
                $("<div class=\"btn-group btn-group-sm\">").append(
                    $("<button type=\"button\" class=\"btn btn-primary\" data-action=\"download\">").attr("data-index", index).text(i18next.t("common:store-download")),
                    $("<button type=\"button\" class=\"btn btn-success\" data-action=\"backup\">").attr("data-index", index).text(i18next.t("common:store-backup"))
                )
            ));

            body.append(row);
        });

        $("#store-status").text(this.profiles.length === 0
            ? i18next.t("common:store-empty")
            : i18next.t("common:store-loaded", {count: this.profiles.length}));
    }

    /**
     * Reads one stored profile's EEPROM bytes in chunks.
     *
     * @param {number} index - The profile's position in the list.
     * @return {Promise<Uint8Array | null>} The bytes, or null on failure.
     */
    private async read(index: number): Promise<Uint8Array<ArrayBuffer> | null> {
        const profile = this.profiles[index];
        const out = new Uint8Array(profile.size);

        try {
            for (let offset = 0; offset < profile.size;) {
                const chunk = Math.min(this.chunk, profile.size - offset);
                const response = await this.send("GET", this.path("/xsfp/favorites/data"), {index, offset, chunk}, 10000);

                if (!(response.body instanceof Uint8Array) || response.body.length === 0) {
                    throw new Error(`Invalid chunk at offset ${offset}`);
                }

                out.set(response.body.slice(0, profile.size - offset), offset);
                offset += response.body.length;
            }
        } catch (e) {
            console.warn(`Failed to read stored profile ${index}.`, e);
            Notify.failure(i18next.t("common:store-read-error"));
            return null;
        }

        // Guard against the list and the store changing underneath us (e.g. edited on the device).
        if (Eeprom.identity(out).sn !== profile.sn) {
            console.warn(`Stored profile ${index} serial mismatch: expected ${profile.sn}, got ${Eeprom.identity(out).sn}.`);
            Notify.failure(i18next.t("common:store-changed"));
            return null;
        }

        return out;
    }

    /**
     * Downloads a stored profile as a .uieeprom file.
     */
    private async download(index: number): Promise<void> {
        const data = await this.read(index);
        if (!data) return;

        const identity = Eeprom.identity(data);
        const blob = new Blob([data], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${identity.vendor}-${identity.part}-${identity.sn}.uieeprom`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    /**
     * Copies a stored profile into the local Backup Library (My Backups).
     */
    private async saveToBackups(index: number): Promise<void> {
        const data = await this.read(index);
        if (!data) return;

        const identity = Eeprom.identity(data);

        try {
            await BackupStore.save({
                sn: identity.sn,
                partNumber: identity.part,
                vendor: identity.vendor,
                type: this.profiles[index].type,
                size: data.length,
                data
            });

            Notify.success(i18next.t("common:backup-saved-message"));
            this.onBackupSaved();
        } catch (e) {
            console.warn("Failed to store local backup.", e);
            Notify.failure(i18next.t("common:backup-save-error"));
        }
    }
}
