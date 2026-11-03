import { useEffect, useRef } from "react";
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // Keep the original trigger through StrictMode's setup/cleanup replay.
    if (!previousFocus.current)
      previousFocus.current = document.activeElement as HTMLElement | null;
    const previous = previousFocus.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) ?? [],
      ).filter((item) => item.getClientRects().length > 0);
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !items.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !items.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", keydown);
      // The board removes `inert` in the same commit; restore focus after that effect.
      queueMicrotask(() => {
        if (ref.current?.isConnected) return;
        if (previous?.isConnected && previous !== document.body)
          previous.focus();
        else document.querySelector<HTMLElement>("#requests-title")?.focus();
      });
    };
  }, []);
  return ref;
}
