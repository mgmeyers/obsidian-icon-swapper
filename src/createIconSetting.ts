import { setIcon, Setting, TextAreaComponent } from "obsidian";
import { IconManager, validSvgRegEx } from "./iconManager";

export function createIconSetting(opts: {
  containerEl: HTMLElement;
  name: string;
  iconManager: IconManager;
}) {
  const { containerEl, name, iconManager } = opts;
  let textComponent: TextAreaComponent;

  const s = new Setting(containerEl)
    .addTextArea((textarea) => {
      textComponent = textarea;

      if (iconManager.icons[name]) {
        textarea.setValue(iconManager.icons[name]);
      }

      textarea.onChange(async (v) => {
        const svg = v.trim()

        if (svg && validSvgRegEx.test(svg)) {
          await iconManager.setIcon(name, svg)
        } else {
          await iconManager.revertIcon(name)
        }
      });
    })
    .addExtraButton((b) => {
      b.setIcon("reset");
      b.onClick(async () => {
        textComponent.setValue("");
        await iconManager.revertIcon(name)
      });
      b.setTooltip("Restore default");
    });

  const icoContainer = createDiv({ cls: "icon-swapper-container" });
  const icoIcon = createDiv({ cls: "icon-swapper-icon" });
  const icoName = createDiv({ cls: "icon-swapper-name" });

  setIcon(icoIcon, name, 20);

  icoName.setText(name);

  icoContainer.appendChild(icoIcon);
  icoContainer.appendChild(icoName);

  s.nameEl.appendChild(icoContainer);
}
