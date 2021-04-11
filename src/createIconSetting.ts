import { setIcon, Setting, TextAreaComponent } from "obsidian";
import { IconManager, validSvgRegEx } from "./iconManager";

interface Options {
  containerEl: HTMLElement;
  name: string;
  iconManager: IconManager;
}

export function createIconSetting({ containerEl, name, iconManager }: Options) {
  let textComponent: TextAreaComponent;

  new Setting(containerEl)

    // SVG input textarea
    .addTextArea((textarea) => {
      textComponent = textarea;

      if (iconManager.icons[name]) {
        textarea.setValue(iconManager.icons[name]);
      }

      textarea.onChange(async (v) => {
        const svg = v.trim();

        if (svg && validSvgRegEx.test(svg)) {
          await iconManager.setIcon({ name, svg });
        } else {
          await iconManager.revertIcon({ name });
        }
      });
    })

    // Reset icon button
    .addExtraButton((b) => {
      b.setIcon("reset")
        .setTooltip("Restore default")
        .onClick(async () => {
          textComponent.setValue("");
          await iconManager.revertIcon({ name });
        });
    })

    // Icon display
    .then((setting) => {
      setting.nameEl.createDiv(
        { cls: "icon-swapper-container" },
        (container) => {
          container.createDiv({ cls: "icon-swapper-icon" }, (icon) => {
            // Note: This, confusingly, is obsidian's `setIcon`, not `iconManager.setIcon`.
            //       It's used to render an icon to the DOM
            setIcon(icon, name, 20);
          });

          container.createDiv({ cls: "icon-swapper-container" }, (icoName) => {
            icoName.setText(name);
          });
        }
      );
    });
}
