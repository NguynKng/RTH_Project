import { useEffect, useMemo, useRef, useState } from "react";
import { getRequest } from "../api/endpoints";
import { useNotificationStore } from "../data/notifications";

/** Hydrate just the five visible inbox records after reload/cache eviction.
 * The API client limits detail fetch concurrency to two, and every view is abortable. */
export function useUnreadRequests(ids: number[]) {
  const records = useNotificationStore((state) => state.records);
  const idsKey = ids.join(",");
  const missingKey = ids.filter((id) => !records[id]).join(",");
  const [retry, setRetry] = useState(0);
  const handledRetry = useRef(0);
  const [load, setLoad] = useState({
    key: "",
    loading: false,
    failed: [] as number[],
  });
  const failures = useRef({ key: "", ids: new Set<number>() });
  const viewKey = `${idsKey}:${retry}`;

  useEffect(() => {
    const force = handledRetry.current !== retry;
    handledRetry.current = retry;
    if (failures.current.key !== viewKey)
      failures.current = { key: viewKey, ids: new Set() };
    const pending = (force ? idsKey : missingKey)
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((id) => !failures.current.ids.has(id));
    if (!pending.length) {
      setLoad((previous) =>
        previous.key === viewKey && previous.loading
          ? { ...previous, loading: false }
          : previous,
      );
      return;
    }
    const controller = new AbortController();
    setLoad({ key: viewKey, loading: true, failed: [...failures.current.ids] });
    void Promise.allSettled(
      pending.map((id) => getRequest(id, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const fetched = results.flatMap((result, index) => {
        if (result.status === "fulfilled") return [result.value];
        failures.current.ids.add(pending[index]);
        return [];
      });
      useNotificationStore.getState().cacheUnreadRequests(fetched);
      setLoad({
        key: viewKey,
        loading: false,
        failed: [...failures.current.ids],
      });
    });
    return () => controller.abort();
  }, [idsKey, missingKey, viewKey, retry]);

  const failed = useMemo(
    () => (load.key === viewKey ? load.failed : []),
    [load, viewKey],
  );
  const loading =
    (load.key === viewKey && load.loading) ||
    missingKey
      .split(",")
      .filter(Boolean)
      .some((id) => !failed.includes(Number(id)));
  return {
    records,
    failed,
    loading,
    retry: () => setRetry((value) => value + 1),
  };
}
