import { INode, parse, stringify } from "svgson";
import {
  getDefaultIconSVG,
  getMaxViewBox,
  replaceIconSVG,
  scalePath,
} from "./svg";

export const validSvgRegEx = /^<svg[^>]+?>[\w\W]+?<\/svg>?/i;

// Convert a user-supplied SVG to the correct format and size for addIcon
export async function svgToIcon(value: string) {
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
              : scalePath(path, { scale: 100 / maxViewBox, round: 3 })
          )
        );
      });
    }

    return children.join("");
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

    for (const icon in icons) {
      await this.setIcon({
        name: icon,
        svg: icons[icon],
        shouldSave: false,
        isTrustedSource: true,
      });
    }
  }

  async setIcon(opts: {
    name: string;
    svg: string;
    shouldSave?: boolean;
    isTrustedSource?: boolean;
  }) {
    const { name, svg, shouldSave = true, isTrustedSource = false } = opts;

    // Store a copy of the default icon if we haven't already
    if (!this.defaults[name]) {
      this.defaults[name] = getDefaultIconSVG(name);
    }

    const iconSVG = isTrustedSource ? svg : await svgToIcon(svg);

    replaceIconSVG(name, iconSVG);
    this.icons[name] = iconSVG;

    if (shouldSave) {
      await this.save(this.icons);
    }
  }

  async setAll(icons: Icons) {
    for (const icon in icons) {
      const svg = (icons[icon] || "").trim();

      // Try to validate the SVG string as best we can
      if (!svg) continue;
      if (!validSvgRegEx.test(svg)) continue;

      await this.setIcon({ name: icon, svg, shouldSave: false });
    }

    await this.save(this.icons);
  }

  async revertIcon(opts: { name: string; shouldSave?: boolean }) {
    const { name, shouldSave = true } = opts;

    // Replace the supplied icon with the default
    if (this.icons[name]) {
      replaceIconSVG(name, this.defaults[name]);
      delete this.icons[name];
    }

    if (shouldSave) {
      await this.save(this.icons);
    }
  }

  async revertAll(opts: { shouldSave?: boolean } = {}) {
    const { shouldSave = true } = opts;

    for (const icon in this.icons) {
      this.revertIcon({ name: icon, shouldSave: false });
    }

    if (shouldSave) {
      await this.save(this.icons);
    }
  }
}
