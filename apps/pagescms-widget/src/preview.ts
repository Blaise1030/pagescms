import type { PreviewBind, PreviewBinding } from "./types";

export function applyBinding(
  element: Element | null,
  bind: PreviewBind,
  value: string | boolean | null | undefined,
) {
  if (!element) return;

  switch (bind) {
    case "text":
      element.textContent = value == null ? "" : String(value);
      return;
    case "html":
      element.innerHTML = value == null ? "" : String(value);
      return;
    case "value":
      if ("value" in element) {
        (element as HTMLInputElement).value = value == null ? "" : String(value);
      } else {
        element.setAttribute("value", value == null ? "" : String(value));
      }
      return;
    case "src":
      element.setAttribute("src", value == null ? "" : String(value));
      if ("src" in element) {
        (element as HTMLImageElement).src = value == null ? "" : String(value);
      }
      return;
    case "href":
      element.setAttribute("href", value == null ? "" : String(value));
      if ("href" in element) {
        (element as HTMLAnchorElement).href = value == null ? "" : String(value);
      }
      return;
    case "checked":
      if ("checked" in element) {
        (element as HTMLInputElement).checked = Boolean(value);
      } else if (value) {
        element.setAttribute("checked", "checked");
      } else {
        element.removeAttribute("checked");
      }
      return;
    case "content":
      element.setAttribute("content", value == null ? "" : String(value));
      return;
    default:
      return;
  }
}

function hideRepeatedNode(node: HTMLElement) {
  if (!node.hasAttribute("data-pagescms-display")) {
    node.setAttribute("data-pagescms-display", node.style.display || "");
  }
  node.style.display = "none";
}

function showRepeatedNode(node: HTMLElement) {
  const previousDisplay = node.getAttribute("data-pagescms-display");
  node.style.display = previousDisplay == null ? "" : previousDisplay;
}

export function resolveRepeatedTargets(selector: string, desiredCount: number) {
  if (selector.includes("{n}")) {
    const indexedTargets: Element[] = [];
    for (let index = 0; index < desiredCount; index += 1) {
      const indexedElement = document.querySelector(
        selector.replace(/\{n\}/g, String(index + 1)),
      );
      if (indexedElement) {
        indexedTargets.push(indexedElement);
      }
    }
    return indexedTargets;
  }

  const matchedNodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

  if (matchedNodes.length === 0) return [];

  if (desiredCount === 0) {
    matchedNodes.forEach((node) => {
      hideRepeatedNode(node);
    });
    return [];
  }

  const templateNode = matchedNodes[0];
  const parentNode = templateNode.parentElement;

  if (!parentNode) {
    return matchedNodes.slice(0, desiredCount);
  }

  while (matchedNodes.length < desiredCount) {
    const clone = templateNode.cloneNode(true) as HTMLElement;
    parentNode.appendChild(clone);
    matchedNodes.push(clone);
  }

  matchedNodes.forEach((node, index) => {
    if (index < desiredCount) {
      showRepeatedNode(node);
    } else {
      hideRepeatedNode(node);
    }
  });

  return matchedNodes.slice(0, desiredCount);
}

export function applyPreviewBinding(
  binding: PreviewBinding,
  warnedPreviewTargets: Record<string, boolean>,
  onDebug: (level: "info" | "warn", message: string) => void,
) {
  if (!binding?.target || !binding.bind) return 0;

  if (Array.isArray(binding.value)) {
    const targets = resolveRepeatedTargets(binding.target, binding.value.length);
    if (targets.length === 0 && !warnedPreviewTargets[binding.target]) {
      warnedPreviewTargets[binding.target] = true;
      console.warn("[Pages CMS] Preview target not found:", binding.target);
      onDebug("warn", `Preview target not found: ${binding.target}`);
    }
    binding.value.forEach((item, index) => {
      applyBinding(targets[index] ?? null, binding.bind, item);
    });
    return targets.length;
  }

  const target = document.querySelector(binding.target);
  if (!target && !warnedPreviewTargets[binding.target]) {
    warnedPreviewTargets[binding.target] = true;
    console.warn("[Pages CMS] Preview target not found:", binding.target);
    onDebug("warn", `Preview target not found: ${binding.target}`);
  }
  applyBinding(target, binding.bind, binding.value);
  return target ? 1 : 0;
}
