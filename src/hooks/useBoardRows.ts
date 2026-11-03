import { useMemo } from "react";
import { useBoardStore } from "../data/store";
import { buildRows } from "../lib/rows";
import type { Filters } from "../lib/urlState";
export function useBoardRows(filters: Filters, now: Date) {
  const requests = useBoardStore((state) => state.requests);
  const sites = useBoardStore((state) => state.sites);
  const staff = useBoardStore((state) => state.staff);
  const loadedPage = useBoardStore((state) => state.loadedPage);
  return useMemo(() => {
    const pageRequests = Object.fromEntries(
      (loadedPage?.ids ?? []).flatMap((id) =>
        requests[id] ? [[id, requests[id]]] : [],
      ),
    );
    return buildRows(pageRequests, sites, staff, filters, now);
  }, [requests, loadedPage, sites, staff, filters, now]);
}
