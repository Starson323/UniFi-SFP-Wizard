import $ from "jquery";
import i18next from "i18next";
import {Notify} from "notiflix";
import {BackupStore} from "./BackupStore";
import {Eeprom} from "./Eeprom";
import {Repository} from "./Repository";

/**
 * SfpBuilder
 *
 * Builds an SFP/SFP+/SFP28 profile (.uieeprom) from a blank profile or a template (a Repository
 * dump, a backup or a file). A type preset sets the speed/media/reach bytes, the form sets the
 * identity, and the checksums are recalculated on every change. Bytes the form does not cover,
 * such as the vendor-specific area and page A2h, are kept from the template.
 */
export class SfpBuilder {
    // Vendor names exactly as they appear in genuine modules in /repository.
    private static readonly knownVendors = ["CISCO", "CISCO-ACCELINK", "CISCO-FINISAR", "FINISAR CORP.", "FS", "RUCKUS", "Ubiquiti Inc.", "Blade Network"];

    private base: Uint8Array<ArrayBuffer> = Eeprom.blank();
    private baseIdentity = Eeprom.identity(this.base);
    private isBlank = true;
    private built: Uint8Array<ArrayBuffer> | null = null;

    constructor(private readonly onUseForWrite: (data: Uint8Array<ArrayBuffer>, label: string) => void) {
        // Group the types by speed, e.g. "10G (SFP+)".
        [...new Set(Eeprom.types.map(type => type.speed))].forEach(speed => {
            const group = $("<optgroup>").attr("label", speed);
            Eeprom.types.filter(type => type.speed === speed).forEach(type => group.append($("<option>").val(type.id).text(type.label)));
            $("#builder-type").append(group);
        });
        SfpBuilder.knownVendors.forEach(vendor => $("#builder-vendors").append($("<option>").val(vendor)));

        this.refreshTemplates();
        Repository.onLoaded(() => this.refreshTemplates());

        $("#builder-template").on("change", () => this.loadTemplate($("#builder-template").val() as string));
        $("#builder-file").on("change", () => this.loadFile());

        $("#builder-type").on("change", () => this.update());
        $("#builder-form").on("input", "input", () => this.update());
        $("#builder-sn-generate").on("click", () => {
            $("#builder-sn").val(SfpBuilder.randomSerial());
            this.update();
        });

        $("#builder-download").on("click", () => this.download());
        $("#builder-use").on("click", () => {
            if (!this.built) return;

            const identity = Eeprom.identity(this.built);
            this.onUseForWrite(this.built, `${identity.vendor} ${identity.part} (SN ${identity.sn})`);
            Notify.success(i18next.t("common:builder-used"));
        });

        this.loadTemplate("blank");
    }

    /**
     * Rebuilds the template list: blank, Repository dumps and My Backups.
     * Called again whenever the backup library changes.
     */
    public async refreshTemplates(): Promise<void> {
        const select = $("#builder-template");
        const selected = select.val() as string || "blank";

        select.empty().append($("<option>").val("blank").text(i18next.t("common:builder-blank")));

        if (Repository.entries.length > 0) {
            const group = $("<optgroup>").attr("label", i18next.t("common:builder-group-repo"));
            Repository.entries.forEach(entry => group.append($("<option>").val(`repo:${entry.file}`).text(entry.name)));
            select.append(group);
        }

        try {
            const backups = await BackupStore.list();

            if (backups.length > 0) {
                const group = $("<optgroup>").attr("label", i18next.t("common:builder-group-backups"));
                backups.forEach(backup => group.append($("<option>").val(`backup:${backup.id}`).text(`${backup.partNumber} - ${backup.sn} (${backup.vendor})`)));
                select.append(group);
            }
        } catch (e) {
            console.warn("Failed to list backups for the SFP Builder.", e);
        }

        select.val(selected);
    }

    /**
     * Loads a template by its select value ("blank", "repo:<file>" or "backup:<id>").
     */
    private async loadTemplate(value: string): Promise<void> {
        if (!value || value === "blank") {
            this.setBase(Eeprom.blank(), true);
            return;
        }

        try {
            let data: Uint8Array | undefined;

            if (value.startsWith("repo:")) {
                const response = await fetch(Repository.fileUrl(value.substring(5)));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                data = new Uint8Array(await response.arrayBuffer());
            } else if (value.startsWith("backup:")) {
                data = (await BackupStore.get(parseInt(value.substring(7), 10)))?.data;
            }

            if (!data) throw new Error("Template not found");

            this.setTemplate(data);
        } catch (e) {
            console.warn(`Failed to load SFP Builder template '${value}'.`, e);
            Notify.failure(i18next.t("common:builder-template-error"));
        }
    }

    private async loadFile(): Promise<void> {
        const file = ($("#builder-file")[0] as HTMLInputElement).files?.[0];
        if (!file) return;

        this.setTemplate(new Uint8Array(await file.arrayBuffer()));
        $("#builder-file").val("");
    }

    private setTemplate(data: Uint8Array): void {
        if (data.length !== Eeprom.SFP_SIZE || data[0] !== 0x03) {
            Notify.failure(i18next.t("common:builder-sfp-only"));
            return;
        }

        this.setBase(new Uint8Array(data), false);
    }

    /**
     * Sets the starting bytes and fills the form from them.
     */
    private setBase(data: Uint8Array<ArrayBuffer>, blank: boolean): void {
        this.base = data;
        this.baseIdentity = Eeprom.identity(data);
        this.isBlank = blank;

        const fields = Eeprom.fields(data);

        $("#builder-vendor").val(fields.vendor);
        $("#builder-oui").val(blank ? "" : fields.oui);
        $("#builder-part").val(fields.part);
        $("#builder-rev").val(fields.rev);
        $("#builder-sn").val(fields.sn);
        $("#builder-date").val(blank ? SfpBuilder.todayDateCode() : fields.date);

        // A template keeps its own type unless the user picks one; a blank profile needs one.
        $("#builder-type").val(blank ? "10g-sr" : "keep");

        this.update();
    }

    /**
     * Rebuilds the profile from the form and refreshes the preview, warnings and buttons.
     */
    private update(): void {
        const typeId = $("#builder-type").val() as string;
        const type = Eeprom.types.find(t => t.id === typeId);
        const cableLength = parseInt($("#builder-cable").val() as string, 10) || 1;

        $("#builder-cable-group").toggle(type?.cable === true);
        $("#builder-type-help").text(type ? type.help : i18next.t("common:builder-help-keep"));

        const fields = {
            vendor: ($("#builder-vendor").val() as string).trim(),
            oui: ($("#builder-oui").val() as string).trim(),
            part: ($("#builder-part").val() as string).trim(),
            rev: ($("#builder-rev").val() as string).trim(),
            sn: ($("#builder-sn").val() as string).trim(),
            date: ($("#builder-date").val() as string).trim()
        };

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!fields.vendor) errors.push(i18next.t("common:builder-error-vendor"));
        if (!fields.part) errors.push(i18next.t("common:builder-error-part"));
        if (!Object.values(fields).every(Eeprom.isAscii)) errors.push(i18next.t("common:builder-error-ascii"));
        if (fields.oui && !Eeprom.parseOui(fields.oui)) errors.push(i18next.t("common:builder-error-oui"));

        const data = new Uint8Array(this.base);

        if (type) Eeprom.applyType(data, type, cableLength);
        Eeprom.setFields(data, fields);
        Eeprom.updateChecksums(data);

        const identityChanged = fields.vendor !== this.baseIdentity.vendor || fields.part !== this.baseIdentity.part || fields.sn !== this.baseIdentity.sn;

        if (!this.isBlank && Eeprom.hasVendorData(this.base) && identityChanged) warnings.push(i18next.t("common:builder-warn-vendor-data"));
        if (!this.isBlank && type && Eeprom.hasDiagnostics(this.base)) warnings.push(i18next.t("common:builder-warn-diagnostics"));
        if (this.isBlank) warnings.push(i18next.t("common:builder-info-blank"));

        this.built = errors.length === 0 ? data : null;

        const messages = $("#builder-messages").empty();
        errors.forEach(text => messages.append($("<li class=\"text-danger\">").text(text)));
        warnings.forEach(text => messages.append($("<li class=\"text-warning\">").text(text)));

        $("#builder-summary").text(`${fields.vendor || "?"} ${fields.part || "?"}, ${Eeprom.describe(data)}`);
        $("#builder-hex").text(Eeprom.hexDump(data.slice(0, 128)));
        $("#builder-download, #builder-use").prop("disabled", this.built === null);
    }

    private download(): void {
        if (!this.built) return;

        const identity = Eeprom.identity(this.built);
        const name = `${identity.vendor}-${identity.part}-${identity.sn || "NOSN"}`.replace(/[^A-Za-z0-9._-]+/g, "_");
        const blob = new Blob([this.built], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${name}.uieeprom`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    /**
     * Today's date as an SFF-8472 date code (YYMMDD).
     */
    private static todayDateCode(): string {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");

        return `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    }

    /**
     * A random 12 character serial number from uppercase letters and digits.
     */
    private static randomSerial(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
        const bytes = crypto.getRandomValues(new Uint8Array(12));

        return Array.from(bytes).map(b => chars[b % chars.length]).join("");
    }
}
