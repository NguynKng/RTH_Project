import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  defaultFilters,
  applyFiltersPatch,
  parseFilters,
  toSearchParams,
  type Filters,
} from "../lib/urlState";
import { useBoardStore } from "../data/store";
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const sites = useBoardStore((state) => state.sites);
  const defaults = useMemo(
    () =>
      defaultFilters(
        new Date(),
        Object.values(sites).map((site) => site.timezone),
      ),
    [sites],
  );
  const search = params.toString();
  const filters = useMemo(
    () => parseFilters(new URLSearchParams(search), defaults),
    [search, defaults],
  );
  const canonical = toSearchParams(filters).toString();
  useEffect(() => {
    if (search !== canonical) setParams(canonical, { replace: true });
  }, [search, canonical, setParams]);
  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (current) => {
          return toSearchParams(
            applyFiltersPatch(parseFilters(current, defaults), patch),
          );
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );
  return [filters, setFilters, defaults] as const;
}
