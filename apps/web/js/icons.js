// Shared original 24px outline icons, in the Feather/Lucide visual style.
export const ICONS = {
  "clone-yesterday": "M9 5H5v14h14v-4 M9 3h12v12H9z",
  "export-today-plan": "M12 15V3m-4 4 4-4 4 4 M5 13v7h14v-7",
  "copy-today-plan": "M9 9h12v12H9z M15 9V3H3v12h6",
  "defer-pending-tomorrow": "M4 12h16m-6-6 6 6-6 6",
  "hide-done-today": "m5 7 4 4 8-8 M5 17h14",
  "ally-clear": "m6 6 12 12M6 18 18 6",
  "undo": "M9 4 3 10l6 6 M3 10h11a6 6 0 0 1 0 12",
  "ally-propose": "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  "add": "M12 5v14M5 12h14",
  "edit": "m4 16-1 5 5-1L20 8l-4-4z",
  "clear": "m6 6 12 12M6 18 18 6",
  "notice": "M12 8v5m0 3v1 M12 3 2 21h20z",
  "pause": "M8 4v16M16 4v16",
  "extend": "M12 5v14M5 12h14",
  "end": "M5 5h14v14H5z",
  close: "m6 6 12 12M6 18 18 6",
  windows: "M3 4h8v7H3z M13 4h8v7h-8z M3 13h8v7H3z M13 13h8v7h-8z",
  menu: "M4 6h16M4 12h16M4 18h16",
  today: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  targets: "m12 3 9 9-9 9-9-9z",
  review: "m5 12 4 4L19 6",
  usage: "M12 3v9h9 M9 3.5a9 9 0 1 0 11.5 11.5",
  blocks: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
  setup: "M4 7h16M4 17h16 M8 4v6M16 14v6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

export function icon(name, { label } = {}) {
  const safeLabel = String(label || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon">${safeLabel ? `<title>${safeLabel}</title>` : ""}<path d="${ICONS[name] || ICONS.notice}"/></svg>`;
}

export function hydrateIcons(root = document) {
  for (const node of root.querySelectorAll("[data-icon]")) node.innerHTML = icon(node.dataset.icon);
  for (const node of root.querySelectorAll(".icon-button")) {
    node.classList.add("icon-control");
    if (!node.dataset.label) node.dataset.label = node.getAttribute("aria-label") || "";
  }
}
