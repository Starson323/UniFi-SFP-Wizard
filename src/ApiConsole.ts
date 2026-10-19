import $ from "jquery";
import i18next from "i18next";
import {Confirm, Notify} from "notiflix";
import {Eeprom} from "./Eeprom";

/**
 * Sends an API request to the Wizard and resolves with the decoded {header, body, type} response.
 */
export type ApiSender = (method: "GET" | "POST", path: string, body: any, timeoutMs: number) => Promise<any>;

interface ConsolePreset {
    label: string;
    method: "GET" | "POST";
    path: string;
    body: any;
}

interface SessionEntry {
    time: string;
    method: string;
    path: string;
    request: any;
    header?: any;
    body?: any;
    binaryHex?: string;
    error?: string;
}

/**
 * ApiConsole
 *
 * A raw request console for exploring undocumented Wizard endpoints (e.g. the 1.1.8 Profile
 * Store, internally called "favorites"). Every exchange is kept in a session log that can be
 * downloaded as JSON, so findings can be shared and turned into real features.
 */
export class ApiConsole {
    // Read-only requests that are safe to probe. POSTs are left out on purpose.
    private static readonly presets: ConsolePreset[] = [
        {label: "Profile Store: list profiles", method: "GET", path: "/xsfp/favorites/start", body: {}},
        {label: "Profile Store: read profile #0", method: "GET", path: "/xsfp/favorites/data", body: {index: 0, offset: 0, chunk: 512}},
        {label: "Restore: list records", method: "GET", path: "/xsfp/recover/records/start", body: {}},
        {label: "Restore: read records (first 2048 bytes)", method: "GET", path: "/xsfp/recover/records/data", body: {offset: 0, chunk: 2048}},
        {label: "DDM: valid", method: "GET", path: "/ddm/valid", body: {}},
        {label: "DDM: start", method: "GET", path: "/ddm/start", body: {}},
        {label: "Module: details", method: "GET", path: "/xsfp/module/details", body: {}},
        {label: "Firmware info", method: "GET", path: "/fw", body: {}},
        {label: "Device settings", method: "GET", path: "/settings", body: {}},
        {label: "API version", method: "GET", path: "/api/1.0/version", body: {}},
    ];

    private readonly session: SessionEntry[] = [];

    constructor(private readonly send: ApiSender, private readonly getMac: () => string) {
        const presetSelect = $("#api-console-preset");

        ApiConsole.presets.forEach((preset, index) => {
            presetSelect.append($("<option>").val(String(index)).text(preset.label));
        });

        presetSelect.on("change", () => {
            const preset = ApiConsole.presets[parseInt(presetSelect.val() as string, 10)];

            if (preset) {
                $("#api-console-method").val(preset.method);
                $("#api-console-path").val(preset.path);
                $("#api-console-body").val(JSON.stringify(preset.body));
            }
        });

        $("#api-console-send").on("click", () => this.onSend());
        $("#api-console-download").on("click", () => this.downloadSession());
    }

    /**
     * Validates the form and sends the request, asking for confirmation first on POST.
     *
     * @return {void} This method does not return a value.
     */
    private onSend(): void {
        const method = $("#api-console-method").val() as "GET" | "POST";
        const rawPath = ($("#api-console-path").val() as string).trim();
        const rawBody = ($("#api-console-body").val() as string).trim();

        if (!rawPath.startsWith("/")) {
            Notify.failure(i18next.t("common:console-path-invalid"));
            return;
        }

        let body: any = {};

        try {
            body = rawBody ? JSON.parse(rawBody) : {};
        } catch (e) {
            Notify.failure(i18next.t("common:console-body-invalid"));
            return;
        }

        // Paths are relative to the device unless given absolutely (e.g. /api/1.0/version).
        const path = rawPath.startsWith("/api/") ? rawPath : `/api/1.0/${this.getMac()}${rawPath}`;

        if (method === "POST") {
            Confirm.show(i18next.t("common:console-post-title"), i18next.t("common:console-post-message"), i18next.t("common:yes"), i18next.t("common:no"), () => {
                this.execute(method, path, body);
            });
        } else {
            this.execute(method, path, body);
        }
    }

    /**
     * Sends the request, renders the response and records it in the session.
     *
     * @param {"GET" | "POST"} method - The HTTP method.
     * @param {string} path - The absolute API path.
     * @param body - The JSON request body.
     * @return {Promise<void>} Resolves once the response (or error) has been rendered.
     */
    private async execute(method: "GET" | "POST", path: string, body: any): Promise<void> {
        const entry: SessionEntry = {time: new Date().toISOString(), method, path, request: body};

        $("#api-console-output").text(`${method} ${path}\n${JSON.stringify(body)}\n\n…`);

        try {
            const response = await this.send(method, path, body, 10000);

            entry.header = response.header;

            if (response.body instanceof Uint8Array) {
                entry.binaryHex = ApiConsole.toHex(response.body);
            } else {
                entry.body = response.body;
            }

            $("#api-console-output").text(ApiConsole.format(method, path, body, response));
        } catch (e: any) {
            entry.error = String(e?.message ?? e);

            $("#api-console-output").text(`${method} ${path}\n${JSON.stringify(body)}\n\nERROR: ${entry.error}`);
        }

        this.session.push(entry);
        $("#api-console-count").text(String(this.session.length));
    }

    /**
     * Formats a response for display: header as JSON, body as JSON or a hex dump.
     */
    private static format(method: string, path: string, request: any, response: any): string {
        const lines = [`${method} ${path}`, JSON.stringify(request), "", "Header:", JSON.stringify(response.header, null, 2), ""];

        if (response.body instanceof Uint8Array) {
            lines.push(`Body (binary, ${response.body.length} bytes):`, Eeprom.hexDump(response.body));
        } else {
            lines.push("Body:", JSON.stringify(response.body, null, 2));
        }

        return lines.join("\n");
    }

    private static toHex(data: Uint8Array): string {
        return Array.from(data).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * Downloads every exchange of this session as a JSON file.
     *
     * @return {void} This method does not return a value.
     */
    private downloadSession(): void {
        const blob = new Blob([JSON.stringify(this.session, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `wizard-api-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }
}
