import { signal } from "@preact/signals-react";

export const toastMsg = signal<{ text: string; id: number } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string) {
  toastMsg.value = { text, id: Date.now() };
  clearTimeout(timer);
  timer = setTimeout(() => (toastMsg.value = null), 2600);
}
