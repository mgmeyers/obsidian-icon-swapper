import {
  App,
  ButtonComponent,
  Modal,
  Plugin,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
} from "obsidian";
import { parse, stringify } from "yaml";

import { icons } from "./icons";
import { createIconSetting } from "./createIconSetting";
import { IconManager, Icons } from "./iconManager";

export default class IconSwapperPlugin extends Plugin {
  settingsTab: IconSwapperSettingsTab;
  iconManager: IconManager;

  async onload() {
    // Set up the settings tab
    this.settingsTab = new IconSwapperSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    // Set up the icon manager
    const saveIcons = async (icons: Icons) => await this.saveData(icons);
    const loadIcons = async () => Object.assign({}, await this.loadData());

    this.iconManager = new IconManager(saveIcons, loadIcons);

    // Load any stored icons
    await this.iconManager.loadIcons();
  }

  onunload() {
    // Revert all icons back to default, but don't save anything
    this.iconManager.revertAll(true);
  }
}

class ExportModal extends Modal {
  plugin: IconSwapperPlugin;

  constructor(app: App, plugin: IconSwapperPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    modalEl.addClass("modal-icon-swapper");

    const output = stringify(this.plugin.iconManager.icons);

    const header = new Setting(contentEl).setName("Export icon configuration");

    // Build a download link
    const exportButton = createEl("a", {
      cls: "icon-swapper-download",
      text: "Download",
    });

    exportButton.setAttr("download", "obsidian.icons");
    exportButton.setAttr(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(output)}`
    );

    // Build a copy to clipboard link
    const copyButton = createEl("a", {
      cls: "icon-swapper-copy",
      text: "Copy to clipboard",
      href: "#",
    });

    header.controlEl.appendChild(copyButton);
    header.controlEl.appendChild(exportButton);

    const textarea = new TextAreaComponent(contentEl)
      .setValue(output)
      .then((ta) => {
        ta.inputEl.setAttr("disabled", true);
      });

    copyButton.addEventListener("click", (e) => {
      e.preventDefault();

      // Select the textarea contents and copy them to the clipboard
      textarea.inputEl.select();
      document.execCommand("copy");

      copyButton.addClass("success");

      setTimeout(() => {
        // If the button is still in the dom, remove the success class
        if (copyButton.parentNode) {
          copyButton.removeClass("success");
        }
      }, 2000);
    });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

class ImportModal extends Modal {
  plugin: IconSwapperPlugin;

  constructor(app: App, plugin: IconSwapperPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    let { contentEl, modalEl } = this;

    modalEl.addClass("modal-icon-swapper");

    new Setting(contentEl)
      .setName("Import icon configuration")
      .setDesc("Warning: this will override any existing icon configuration");

    const header = new Setting(contentEl);

    // Build an error message container
    const errorSpan = createSpan({
      cls: "icon-swapper-import-error",
      text: "Error importing config",
    });

    header.nameEl.appendChild(errorSpan);

    // Build a file import button
    const importButton = createEl("input", {
      cls: "icon-swapper-import-input",
    });

    importButton.setAttr("id", "icon-swapper-import-input");
    importButton.setAttr("name", "icon-swapper-import-input");
    importButton.setAttr("type", "file");
    importButton.setAttr("accept", ".icons");

    const importLabel = createEl("label", {
      cls: "icon-swapper-import-label",
      text: "Import from file",
    });

    importLabel.setAttr("for", "icon-swapper-import-input");

    // Attempt to parse the imported data and close if successful
    const importAndClose = async (str: string) => {
      if (str) {
        try {
          const importedSettings = parse(str);

          await this.plugin.iconManager.revertAll();
          await this.plugin.iconManager.setAll(importedSettings);

          this.plugin.settingsTab.display();
          this.close();
        } catch (e) {
          errorSpan.addClass("active");
          errorSpan.setText(`Error importing icon settings: ${e}`);
        }
      } else {
        errorSpan.addClass("active");
        errorSpan.setText(`Error importing icon settings: config is empty`);
      }
    };

    // Set up a FileReader so we can parse the file contents
    importButton.addEventListener("change", (e) => {
      const reader = new FileReader();

      reader.onload = async (e: ProgressEvent<FileReader>) => {
        await importAndClose(e.target.result.toString().trim());
      };

      reader.readAsText((e.target as HTMLInputElement).files[0]);
    });

    header.controlEl.appendChild(importButton);
    header.controlEl.appendChild(importLabel);

    new TextAreaComponent(contentEl)
      .setPlaceholder("Paste config here...")
      .then((ta) => {
        new ButtonComponent(contentEl)
          .setButtonText("Save")
          .onClick(async () => {
            await importAndClose(ta.getValue().trim());
          });
      });
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

class IconSwapperSettingsTab extends PluginSettingTab {
  plugin: IconSwapperPlugin;

  constructor(app: App, plugin: IconSwapperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

    containerEl.empty();
    containerEl.addClass("icon-swapper");

    const header = new Setting(containerEl);

    // Build and export link to open the export modal
    const exportButton = createEl("a", {
      cls: "icon-swapper-export",
      text: "Export",
      href: "#",
    });

    exportButton.addEventListener("click", (e) => {
      e.preventDefault();
      new ExportModal(this.app, this.plugin).open();
    });

    // Build and import link to open the import modal
    const importButton = createEl("a", {
      cls: "icon-swapper-import",
      text: "Import",
      href: "#",
    });

    importButton.addEventListener("click", (e) => {
      e.preventDefault();
      new ImportModal(this.app, this.plugin).open();
    });

    header.controlEl.appendChild(importButton);
    header.controlEl.appendChild(exportButton);

    // Build a revert link
    header.addExtraButton((b) => {
      b.setIcon("reset");
      b.onClick(async () => {
        await this.plugin.iconManager.revertAll();

        // Rebuild settings pane after the changes have been made
        this.display();
      });
      b.setTooltip("Restore default icons");
    });

    // Build a setting for each icon
    icons.forEach((name) => {
      createIconSetting({
        containerEl,
        name,
        iconManager: this.plugin.iconManager,
      });
    });
  }
}
