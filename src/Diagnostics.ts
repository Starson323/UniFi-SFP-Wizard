import $ from "jquery";
import i18next from "i18next";
import {Notify} from "notiflix";
import {ApiSender} from "./ApiConsole";

/**
 * Alarm and warning limits for one reading, as reported by the module.
 */
interface Limits {
    alarmHigh: number;
    warnHigh: number;
    warnLow: number;
    alarmLow: number;
}

/**
 * A parsed DDM report: module properties, limits per reading, and the samples.
 */
export interface DdmReport {
    properties: { [name: string]: string };
    limits: { [reading: string]: Limits };
    columns: string[];
    rows: number[][];
}

/**
 * One reading column, e.g. "2 Tx Power(dBm)" is lane 2 of "Tx Power" in dBm.
 */
interface Column {
    key: string;
    lane: string;
    label: string;
    unit: string;
}

type State = "ok" | "warn" | "alarm" | "none";

/**
 * Diagnostics
 *
 * Live DDM readings recorded by the Wizard's "DDM Info" screen. While that screen is open, the
 * Wizard switches the laser on and appends one CSV sample per second to a report. Confirmed on a
 * device (firmware 1.1.8):
 *
 *   GET /ddm/valid                 -> {"valid": true}
 *   GET /ddm/start                 -> {"chunk": 4096, "size": <current report size>}
 *   GET /ddm/data {offset, chunk}  -> CSV text (binary body)
 *
 * The report keeps growing while DDM Info is open, so the live view polls for new bytes.
 */
export class Diagnostics {
    private static readonly pollMs = 2000;
    private static readonly chartPoints = 120;

    // Raw report bytes; decoded as a whole so multi-byte characters split across chunks stay intact.
    private bytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);
    private report: DdmReport | null = null;
    private timer: number | null = null;
    private busy = false;

    constructor(private readonly send: ApiSender, private readonly getMac: () => string) {
        $("#ddm-start").on("click", () => this.start());
        $("#ddm-stop").on("click", () => this.stop());
        $("#ddm-download").on("click", () => this.download());

        // Pause polling when the Diagnostics tab is left, so it does not compete with other requests.
        // A native listener: jQuery would read "hidden.bs.tab" as event "hidden" in namespace "bs.tab".
        document.querySelector("[data-bs-target=\"#tab-diagnostics\"]")?.addEventListener("hidden.bs.tab", () => this.stop());
    }

    /**
     * Starts the live view: reads the whole report, then polls for new samples.
     */
    public async start(): Promise<void> {
        this.stop();
        this.bytes = new Uint8Array(0);
        this.report = null;
        this.render();

        try {
            const valid = await this.send("GET", this.path("/ddm/valid"), {}, 10000);

            if (valid.body?.valid !== true) {
                this.setStatus(i18next.t("common:ddm-none"));
                return;
            }
        } catch (e) {
            console.warn("Failed to check DDM report.", e);
            return;
        }

        $("#ddm-start").prop("hidden", true);
        $("#ddm-stop").prop("hidden", false);
        this.setStatus(i18next.t("common:ddm-live"));

        await this.poll();
        this.timer = window.setInterval(() => this.poll(), Diagnostics.pollMs);
    }

    /**
     * Stops polling. The readings stay on screen.
     */
    public stop(): void {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
            this.setStatus(this.report ? i18next.t("common:ddm-stopped") : "");
        }

        $("#ddm-start").prop("hidden", false);
        $("#ddm-stop").prop("hidden", true);
    }

    /**
     * Clears everything, e.g. after a disconnect.
     */
    public clear(): void {
        this.stop();
        this.bytes = new Uint8Array(0);
        this.report = null;
        this.setStatus("");
        this.render();
    }

    private path(endpoint: string): string {
        return `/api/1.0/${this.getMac()}${endpoint}`;
    }

    /**
     * Fetches any bytes added to the report since the last poll.
     */
    private async poll(): Promise<void> {
        if (this.busy) return;
        this.busy = true;

        try {
            const start = await this.send("GET", this.path("/ddm/start"), {}, 10000);
            const size: number = start.body?.size ?? 0;
            const chunk: number = start.body?.chunk || 4096;

            // A smaller report means DDM Info was restarted on the Wizard: begin again.
            if (size < this.bytes.length) this.bytes = new Uint8Array(0);

            let offset = this.bytes.length;

            while (offset < size) {
                const response = await this.send("GET", this.path("/ddm/data"), {offset, chunk: Math.min(chunk, size - offset)}, 10000);

                if (!(response.body instanceof Uint8Array) || response.body.length === 0) break;

                // The Wizard may return more than asked while it is still writing; keep only what was asked for.
                const bytes = response.body.slice(0, size - offset);
                const joined = new Uint8Array(this.bytes.length + bytes.length);
                joined.set(this.bytes);
                joined.set(bytes, this.bytes.length);
                this.bytes = joined;
                offset += bytes.length;
            }

            this.report = Diagnostics.parse(new TextDecoder().decode(this.bytes));
            this.render();
        } catch (e) {
            console.warn("Failed to read DDM report.", e);
            this.stop();
            Notify.failure(i18next.t("common:ddm-error"));
        } finally {
            this.busy = false;
        }
    }

    /**
     * Parses the Wizard's DDM CSV report. Rows that are still incomplete are ignored.
     */
    public static parse(text: string): DdmReport {
        const report: DdmReport = {properties: {}, limits: {}, columns: [], rows: []};
        const lines = text.split("\n");
        let section: "properties" | "limits" | "samples" | "" = "";

        // The last line has no newline yet if the Wizard is mid-write.
        if (!text.endsWith("\n")) lines.pop();

        for (const raw of lines) {
            const line = raw.replace(/\r$/, "");
            const cells = line.split(",").map(cell => cell.trim());

            if (cells[0] === "Property") { section = "properties"; continue; }
            if (cells[0] === "Units") { section = "limits"; continue; }
            if (cells[0] === "Time(ms)") { section = "samples"; report.columns = cells; continue; }
            if (cells.every(cell => cell === "")) continue;

            if (section === "properties") {
                report.properties[cells[0]] = cells.slice(1).join(",");
            } else if (section === "limits" && cells.length >= 5) {
                const [alarmHigh, warnHigh, warnLow, alarmLow] = cells.slice(1, 5).map(Number);
                report.limits[cells[0]] = {alarmHigh, warnHigh, warnLow, alarmLow};
            } else if (section === "samples") {
                const values = cells.map(Number);
                if (values.length === report.columns.length && values.every(v => !isNaN(v))) report.rows.push(values);
            }
        }

        return report;
    }

    /**
     * Splits a column name like "2 Tx Power(dBm)" into lane, label and unit.
     */
    private static column(name: string): Column {
        const match = name.match(/^(?:(\d+) )?(.+?)\((.+)\)$/);

        if (!match) return {key: name, lane: "", label: name, unit: ""};

        // The Wizard writes the degree Celsius sign (U+2103); show it as the more common "°C".
        const unit = match[3] === String.fromCharCode(0x2103) ? String.fromCharCode(0xB0) + "C" : match[3];
        const labels: { [name: string]: string } = {"Current": "Laser bias", "Tx Power": "TX power", "Rx Power": "RX power"};
        const label = labels[match[2]] || match[2];

        return {key: `${match[2]}(${match[3]})`, lane: match[1] || "", label, unit};
    }

    private static state(value: number, limits: Limits | undefined): State {
        if (!limits) return "none";
        if (value >= limits.alarmHigh || value <= limits.alarmLow) return "alarm";
        if (value >= limits.warnHigh || value <= limits.warnLow) return "warn";
        return "ok";
    }

    private render(): void {
        const report = this.report;
        const cards = $("#ddm-cards").empty();
        const module = $("#ddm-module").empty();

        $("#ddm-samples").text("");

        $("#ddm-download").prop("disabled", !report || report.rows.length === 0);
        $("#ddm-empty").toggle(!report || report.rows.length === 0);

        if (!report || report.rows.length === 0) return;

        ["Part Number", "Serial Number", "Compliance", "Wave length(nm)"].forEach(name => {
            const value = report.properties[name];
            if (value) module.append($("<dt>").text(name.replace("Wave length(nm)", "Wavelength")), $("<dd>").text(name.startsWith("Wave") ? `${value} nm` : value));
        });

        const last = report.rows[report.rows.length - 1];
        const seconds = Math.round(last[0] / 1000);
        $("#ddm-samples").text(i18next.t("common:ddm-samples", {count: report.rows.length, seconds}));

        report.columns.forEach((name, index) => {
            if (index === 0) return;

            const column = Diagnostics.column(name);
            const limits = report.limits[column.key];
            const value = last[index];
            const noSignal = column.unit === "dBm" && value <= -40;
            const state = noSignal ? "alarm" : Diagnostics.state(value, limits);
            const series = report.rows.slice(-Diagnostics.chartPoints).map(row => row[index]);

            const card = $("<div class=\"ddm-card\">").addClass(`ddm-${state}`);
            card.append($("<div class=\"ddm-label\">").text(column.lane ? `${column.label} (lane ${column.lane})` : column.label));
            card.append($("<div class=\"ddm-value\">").text(noSignal ? i18next.t("common:ddm-no-signal") : `${value.toFixed(2)} ${column.unit}`));

            if (limits) {
                card.append($("<div class=\"ddm-range\">").text(i18next.t("common:ddm-range", {low: limits.warnLow, high: limits.warnHigh, unit: column.unit})));
            }

            card.append(Diagnostics.sparkline(series, limits));
            cards.append(card);
        });
    }

    /**
     * Draws a small SVG line chart, with dashed lines at the warning limits when they are in view.
     */
    private static sparkline(values: number[], limits: Limits | undefined): JQuery<SVGSVGElement> {
        const width = 240, height = 56, pad = 4;
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("class", "ddm-spark");

        // Leave out the -40 dBm "no signal" floor so it does not flatten the rest of the line.
        const visible = values.filter(v => v > -40);
        const scale = [...(visible.length > 0 ? visible : values)];

        // Include the normal range, so the line shows where the reading sits within its limits.
        if (limits) scale.push(limits.warnLow, limits.warnHigh);

        let min = Math.min(...scale), max = Math.max(...scale);

        if (max - min < 0.1) { min -= 0.5; max += 0.5; }

        const y = (v: number) => height - pad - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (height - pad * 2);
        const x = (i: number) => values.length < 2 ? width / 2 : (i / (values.length - 1)) * width;

        if (limits) {
            [limits.warnHigh, limits.warnLow].filter(v => v >= min && v <= max).forEach(v => {
                const line = document.createElementNS(ns, "line");
                line.setAttribute("x1", "0");
                line.setAttribute("x2", String(width));
                line.setAttribute("y1", String(y(v)));
                line.setAttribute("y2", String(y(v)));
                line.setAttribute("class", "ddm-limit");
                svg.appendChild(line);
            });
        }

        const path = document.createElementNS(ns, "polyline");
        path.setAttribute("points", values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "));
        path.setAttribute("class", "ddm-line");
        svg.appendChild(path);

        return $(svg);
    }

    private setStatus(text: string): void {
        $("#ddm-status").text(text);
    }

    /**
     * Downloads the raw report as a CSV file.
     */
    private download(): void {
        if (this.bytes.length === 0) return;

        const part = this.report?.properties["Part Number"] || "module";
        const serial = this.report?.properties["Serial Number"] || "";
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `ddm-${part}-${serial}-${stamp}`.replace(/[^A-Za-z0-9._-]+/g, "_");
        const blob = new Blob([this.bytes], {type: "text/csv"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${name}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }
}
