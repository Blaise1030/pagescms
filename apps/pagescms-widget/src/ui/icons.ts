type IconDefinition = {
  type: string;
  attributes: Record<string, string>;
};

function createIcon(paths: IconDefinition[]) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("style", "width:16px;height:16px;display:block;");

  paths.forEach((definition) => {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      definition.type,
    );
    Object.entries(definition.attributes).forEach(([name, value]) => {
      node.setAttribute(name, value);
    });
    svg.appendChild(node);
  });

  return svg;
}

export function createPencilIcon() {
  return createIcon([
    {
      type: "path",
      attributes: {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
    {
      type: "path",
      attributes: {
        d: "m15 5 4 4",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
  ]);
}

export function createPlusIcon() {
  return createIcon([
    {
      type: "path",
      attributes: {
        d: "M12 5v14",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
    {
      type: "path",
      attributes: {
        d: "M5 12h14",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
  ]);
}

export function createCloseIcon() {
  return createIcon([
    {
      type: "path",
      attributes: {
        d: "M18 6 6 18",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
    {
      type: "path",
      attributes: {
        d: "m6 6 12 12",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
    },
  ]);
}
