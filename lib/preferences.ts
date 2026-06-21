export const POINTER_CURSORS_KEY = "pagescms:pointer-cursors";

export function getPointerCursors(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(POINTER_CURSORS_KEY) === "true";
}

export function setPointerCursors(enabled: boolean): void {
  localStorage.setItem(POINTER_CURSORS_KEY, String(enabled));
  document.documentElement.classList.toggle("pointer-cursors", enabled);
}

export function applyPointerCursors(): void {
  document.documentElement.classList.toggle("pointer-cursors", getPointerCursors());
}
