import { INode } from "svgson";
import toPath from "element-to-path";
import {
  parse as pathParse,
  stringify as pathStringify,
  scale,
} from "svg-path-tools";
import { addIcon, setIcon } from "obsidian";

// Parse the viewbox attribute for the maximum value
// This is used to scale the svgs
export function getMaxViewBox(parsedSVG: INode) {
  const vb = parsedSVG.attributes.viewBox;

  if (!vb) {
    return 0;
  }

  return vb.split(" ").reduce((prev, c) => {
    const next = parseInt(c);

    if (prev > next) {
      return prev;
    }

    return next;
  }, 0);
}

// Scale a parsed SVG; adapted from https://github.com/elrumordelaluz/svg-path-tools
export function scaleSVG(
  node: INode,
  scaleOptions: { scale: number; round: number }
) {
  const o = Object.assign({}, node);
  const { scale: s } = scaleOptions || { scale: 1 };

  if (/(rect|circle|ellipse|polygon|polyline|line|path)/.test(o.name)) {
    const path = toPath(o);
    const parseD = pathParse(path);
    const scaleD = scale(parseD, scaleOptions);
    const d = pathStringify(scaleD);

    o.attributes = Object.assign({}, o.attributes, {
      d,
    });

    for (const attr in o.attributes) {
      if (attr === "stroke-width" || attr === "strokeWidth") {
        o.attributes[attr] = +o.attributes[attr] * s;
      }
      if (!/fill|stroke|opacity|d/.test(attr)) {
        delete o.attributes[attr];
      } else if (/fill|stroke/.test(attr)) {
        o.attributes[attr] = "currentColor";
      }
    }

    if (!o.attributes.fill) o.attributes.fill = "currentColor";
    if (
      !o.attributes.stroke &&
      (o.attributes.strokeWidth || o.attributes["stroke-width"])
    )
      o.attributes.stroke = "currentColor";

    o.name = "path";
  } else if (o.children && Array.isArray(o.children)) {
    const _scale = (c: any) => scaleSVG(c, scaleOptions);
    o.children = o.children.map(_scale);
  }

  return o;
}

// Retrieve the default SVG markup for a given icon name
export function getDefaultIconSVG(name: string) {
  const container = createDiv("div");
  setIcon(container, name);

  const inner = container.children[0].innerHTML;
  container.remove();

  return inner;
}

// Override a default icon's SVG markup
export function replaceIconSVG(name: string, content: string) {
  addIcon(name, content);

  // Replace any icons that already exist in the dom
  document.querySelectorAll(`svg.${name}`).forEach((el) => {
    el.innerHTML = content;
  });
}
