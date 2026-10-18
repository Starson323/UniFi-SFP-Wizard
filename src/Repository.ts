import $ from "jquery";
import i18next from "i18next";
import {Notify} from "notiflix";

export class Repository {
    // Store the GitHub Repository serving the EEPROM Profiles (dumps.json and *.uieeprom).
    private static owner = "Starson323";
    private static repo = "UniFi-SFP-Wizard";
    private static branch = "master";

    /**
     * Builds the raw.githubusercontent.com URL of a file inside the repository folder.
     * raw.githubusercontent.com is not subject to the 60 requests/hour limit of api.github.com.
     *
     * @param {string} filename - The file name inside the repository folder.
     * @return {string} The absolute URL of the file.
     */
    public static fileUrl(filename: string): string {
        return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/repository/${encodeURIComponent(filename)}`;
    }

    /**
     * Fetches dumps.json from the repository and appends one option per entry to the
     * EEPROM Repository select. Shows a visible error if the fetch fails.
     *
     * @return {void} Does not return a value.
     */
    public static fetchTemplates() {
        $.getJSON(this.fileUrl("dumps.json"), (data) => {
            // Remove the static placeholder options (e.g. "Todo") that ship in the
            // markup, keeping only the leading "Select EEPROM Config" prompt.
            $("#sfp-repo option[value]").remove();

            if (data && Array.isArray(data.dumps)) {
                data.dumps.forEach((dump: { file: string, name: string }) => {
                    if (dump.file && dump.file.endsWith(".uieeprom")) {
                        const label = dump.name || dump.file.replace(".uieeprom", "");

                        // Build via .val()/.text() so names from dumps.json can't inject HTML.
                        $("#sfp-repo").append($("<option>").val(dump.file).text(label));
                    }
                });
            }

            console.log("Fetched Templates.");
        }).fail(() => {
            console.warn("Failed to fetch dumps.json.");

            Notify.failure(i18next.t("common:repo-fetch-error"));
        });
    }
}
