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

    document.body.addClass("icon-swapper-enabled");
  }

  onunload() {
    // Revert all icons back to default, but don't save anything
    this.iconManager.revertAll({ shouldSave: false });
    document.body.removeClass("icon-swapper-enabled");
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

    new Setting(contentEl)
      .setName("Export icon configuration")
      .then((setting) => {
        // We only store the interior of the SVG in settings, so for safety and consistency,
        // we wrap the exported SVG with an svg tag set to the correct viewbox
        const wrappedIcons = Object.keys(this.plugin.iconManager.icons).reduce<{
          [k: string]: string;
        }>((icons, currentIcon) => {
          icons[
            currentIcon
          ] = `<svg viewBox="0 0 100 100">${this.plugin.iconManager.icons[currentIcon]}</svg>`;
          return icons;
        }, {});

        const output = stringify(wrappedIcons);

        // Build a copy to clipboard link
        setting.controlEl.createEl(
          "a",
          {
            cls: "icon-swapper-copy",
            text: "Copy to clipboard",
            href: "#",
          },
          (copyButton) => {
            new TextAreaComponent(contentEl)
              .setValue(output)
              .then((textarea) => {
                textarea.inputEl.setAttr("disabled", true);

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
              });
          }
        );

        // Build a download link
        setting.controlEl.createEl("a", {
          cls: "icon-swapper-download",
          text: "Download",
          attr: {
            download: "icons.yml",
            href: `data:text/yaml;charset=utf-8,${encodeURIComponent(output)}`,
          },
        });
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

    new Setting(contentEl).then((setting) => {
      // Build an error message container
      const errorSpan = createSpan({
        cls: "icon-swapper-import-error",
        text: "Error importing config",
      });

      setting.nameEl.appendChild(errorSpan);

      // Attempt to parse the imported data and close if successful
      const importAndClose = async (str: string) => {
        if (str) {
          try {
            const importedSettings = parse(str);

            await this.plugin.iconManager.revertAll({ shouldSave: false });
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

      // Build a file input
      setting.controlEl.createEl(
        "input",
        {
          cls: "icon-swapper-import-input",
          attr: {
            id: "icon-swapper-import-input",
            name: "icon-swapper-import-input",
            type: "file",
            accept: ".yml",
          },
        },
        (importInput) => {
          // Set up a FileReader so we can parse the file contents
          importInput.addEventListener("change", (e) => {
            const reader = new FileReader();

            reader.onload = async (e: ProgressEvent<FileReader>) => {
              await importAndClose(e.target.result.toString().trim());
            };

            reader.readAsText((e.target as HTMLInputElement).files[0]);
          });
        }
      );

      // Build a label we will style as a link
      setting.controlEl.createEl("label", {
        cls: "icon-swapper-import-label",
        text: "Import from file",
        attr: {
          for: "icon-swapper-import-input",
        },
      });

      new TextAreaComponent(contentEl)
        .setPlaceholder("Paste config here...")
        .then((ta) => {
          new ButtonComponent(contentEl)
            .setButtonText("Save")
            .onClick(async () => {
              await importAndClose(ta.getValue().trim());
            });
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

    new Setting(containerEl)
      .then((setting) => {
        // Build and import link to open the import modal
        setting.controlEl.createEl(
          "a",
          {
            cls: "icon-swapper-import",
            text: "Import",
            href: "#",
          },
          (el) => {
            el.addEventListener("click", (e) => {
              e.preventDefault();
              new ImportModal(this.app, this.plugin).open();
            });
          }
        );

        // Build and export link to open the export modal
        setting.controlEl.createEl(
          "a",
          {
            cls: "icon-swapper-export",
            text: "Export",
            href: "#",
          },
          (el) => {
            el.addEventListener("click", (e) => {
              e.preventDefault();
              new ExportModal(this.app, this.plugin).open();
            });
          }
        );
      })

      // Build a revert link
      .addExtraButton((b) => {
        b.setIcon("reset")
          .setTooltip("Restore default icons")
          .onClick(async () => {
            await this.plugin.iconManager.revertAll();

            // Rebuild settings pane after the changes have been made
            this.display();
          });
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
