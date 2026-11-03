import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { planArrivalMotion, type ArrivalFrame } from "../lib/arrivalMotion";

export function useArrivalMotion(
  batch: number,
  arrivalIds: number[],
  view: string,
) {
  const body = useRef<HTMLTableSectionElement>(null);
  const previous = useRef<ArrivalFrame | null>(null);
  const animations = useRef(new Set<Animation>());
  const preference = useRef<MediaQueryList | null>(null);
  const cancel = useCallback(() => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current.clear();
  }, []);

  // Read after each data render so later arrivals use current row heights.
  // offsetTop excludes animated transforms and does not change when the user scrolls.
  useLayoutEffect(() => {
    preference.current ??= window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const elements = Array.from(body.current?.rows ?? []);
    const frame: ArrivalFrame = {
      batch,
      view,
      rows: elements.map((row) => ({
        id: Number(row.dataset.requestRow),
        top: row.offsetTop,
        height: row.offsetHeight,
      })),
    };
    const before = previous.current;
    previous.current = frame;
    if (
      !body.current ||
      preference.current.matches ||
      (before && before.view !== view)
    ) {
      cancel();
      return;
    }
    const plans = planArrivalMotion(before, frame, arrivalIds);
    if (!plans.length) {
      if (
        before?.rows.map((row) => row.id).join(",") !==
        frame.rows.map((row) => row.id).join(",")
      )
        cancel();
      return;
    }
    cancel();
    const byId = new Map(
      elements.map((row) => [Number(row.dataset.requestRow), row]),
    );
    for (const plan of plans) {
      const row = byId.get(plan.id);
      if (!row || typeof row.animate !== "function") continue;
      const animation = row.animate(
        [
          {
            transform: `translateY(${plan.fromY}px)`,
            opacity: plan.entering ? 0 : 1,
          },
          { transform: "translateY(0)", opacity: 1 },
        ],
        {
          duration: 400,
          delay: plan.delay,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        },
      );
      animations.current.add(animation);
      // cancel() rejects finished; both paths release references without an unhandled rejection.
      void animation.finished.then(
        () => animations.current.delete(animation),
        () => animations.current.delete(animation),
      );
    }
  });

  useEffect(() => {
    const media =
      preference.current ??
      window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (media.matches) cancel();
    };
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      cancel();
    };
  }, [cancel]);
  return body;
}
