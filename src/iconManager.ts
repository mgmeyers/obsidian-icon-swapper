import { INode, parse, stringify } from "svgson";
import {
  getDefaultIconSVG,
  getMaxViewBox,
  replaceIconSVG,
  scaleSVG,
} from "./svg";

export const validSvgRegEx = /^<svg[^>]+?>[\w\W]+?<\/svg>?/i;

// Convert a user-supplied SVG to the correct format and size for addIcon
export async function svgToIcon(name: string, value: string) {
  try {
    const parsed = await parse(value);
    const maxViewBox = getMaxViewBox(parsed);
    const children: string[] = [];

    if (maxViewBox) {
      parsed.children.forEach((path: INode) => {
        children.push(
          stringify(
            // Scale the SVG to 100x100 only if the viewbox isn't already at 100
            maxViewBox === 100
              ? path
              : scaleSVG(path, { scale: 100 / maxViewBox, round: 3 })
          )
        );
      });
    }

    replaceIconSVG(name, children.join(""));
  } catch (e) {
    console.error("Error parsing SVG:", e);
  }
}

export interface Icons {
  [k: string]: string;
}

type SaveFn = (icons: Icons) => Promise<void>;
type LoadFn = () => Promise<Icons>;

export class IconManager {
  defaults: Icons;
  icons: Icons;
  save: SaveFn;
  load: LoadFn;

  constructor(save: SaveFn, load: LoadFn) {
    this.defaults = {};
    this.icons = {};
    this.save = save;
    this.load = load;
  }

  async loadIcons() {
    const icons = await this.load();
    await this.setAll(icons);
  }

  async setIcon(name: string, svg: string, skipSave?: boolean) {
    // Store a copy of the default icon if we haven't already
    if (!this.defaults[name]) {
      this.defaults[name] = getDefaultIconSVG(name);
    }

    // Convert the icon and replace the default
    await svgToIcon(name, svg);

    this.icons[name] = svg;

    if (!skipSave) {
      await this.save(this.icons);
    }
  }

  async setAll(icons: Icons) {
    for (const icon in icons) {
      const svg = (icons[icon] || "").trim();

      // Try to validate the SVG string as best we can
      if (!svg) continue;
      if (!validSvgRegEx.test(svg)) continue;

      await this.setIcon(icon, svg, true);
    }

    await this.save(this.icons);
  }

  async revertIcon(name: string, skipSave?: boolean) {
    // Replace the supplied icon with the default
    if (this.icons[name]) {
      replaceIconSVG(name, this.defaults[name]);
      delete this.icons[name];
    }

    if (!skipSave) {
      await this.save(this.icons);
    }
  }

  async revertAll(skipSave?: boolean) {
    for (const icon in this.icons) {
      this.revertIcon(icon, true);
    }

    if (!skipSave) {
      await this.save(this.icons);
    }
  }
}
