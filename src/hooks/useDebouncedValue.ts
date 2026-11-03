import { useEffect, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "../config";
export function useDebouncedValue<T>(value: T, ms = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
