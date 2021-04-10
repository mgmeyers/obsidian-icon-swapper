import {
  App,
  ButtonComponent,
  Modal,
  Plugin,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
} from "obsidian";
import { icons } from "./icons";

import { createIconSetting } from "./createIconSetting";
import { IconManager, Icons } from "./iconManager";

import { parse, stringify } from "yaml";

export default class IconSwapperPlugin extends Plugin {
  settingsTab: IconSwapperSettingsTab;
  iconManager: IconManager;

  async onload() {
    this.settingsTab = new IconSwapperSettingsTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    const saveIcons = async (icons: Icons) => await this.saveData(icons);
    const loadIcons = async () => Object.assign({}, await this.loadData());

    this.iconManager = new IconManager(saveIcons, loadIcons);

    await this.iconManager.loadIcons();
  }

  onunload() {
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

    const exportButton = createEl("a", {
      cls: "icon-swapper-download",
      text: "Download",
    });

    exportButton.setAttr("download", "obsidian.icons");
    exportButton.setAttr(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(output)}`
    );

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
      textarea.inputEl.select();
      document.execCommand("copy");
      copyButton.addClass("success");

      setTimeout(() => {
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
    const errorSpan = createSpan({
      cls: "icon-swapper-import-error",
      text: "Error importing config",
    });

    header.nameEl.appendChild(errorSpan);

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

    const onFileLoad = async (e: ProgressEvent<FileReader>) => {
      const str = e.target.result.toString().trim();
      await importAndClose(str);
    };

    importButton.addEventListener("change", (e) => {
      const reader = new FileReader();
      reader.onload = onFileLoad;
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
            const str = ta.getValue().trim();
            await importAndClose(str);
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

    const exportButton = createEl("a", {
      cls: "icon-swapper-export",
      text: "Export",
      href: "#",
    });

    exportButton.addEventListener("click", (e) => {
      e.preventDefault();
      new ExportModal(this.app, this.plugin).open();
    });

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

    header.addExtraButton((b) => {
      b.setIcon("reset");
      b.onClick(async () => {
        await this.plugin.iconManager.revertAll();
        this.display();
      });
      b.setTooltip("Restore default icons");
    });

    icons.forEach((name) => {
      createIconSetting({
        containerEl,
        name,
        iconManager: this.plugin.iconManager,
      });
    });
  }
}
