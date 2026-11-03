import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUp } from "./icons";
import { Icon } from "./ui";

export function BackToTop({
  containerRef,
  hidden = false,
}: {
  containerRef: RefObject<HTMLDivElement>;
  hidden?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const visibility = useRef(false);
  const update = useCallback(() => {
    const table =
      containerRef.current?.querySelector<HTMLElement>(".table-scroll");
    const next = window.scrollY > 320 || (table?.scrollTop ?? 0) > 320;
    // Only update React when crossing the threshold, not for every scroll pixel.
    if (next !== visibility.current) {
      visibility.current = next;
      setVisible(next);
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    container.addEventListener("scroll", update, {
      passive: true,
      capture: true,
    });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      container.removeEventListener("scroll", update, true);
    };
  }, [containerRef, update]);

  // Filters and page loads may replace a scroller without producing a scroll event.
  useEffect(update);

  if (!visible || hidden) return null;
  return createPortal(
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => {
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth";
        window.scrollTo({ top: 0, behavior });
        containerRef.current
          ?.querySelector(".table-scroll")
          ?.scrollTo({ top: 0, behavior });
        document
          .getElementById("requests-title")
          ?.focus({ preventScroll: true });
      }}
    >
      <Icon as={ArrowUp} size={20} />
    </button>,
    document.body,
  );
}
