import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * have passed without changes. Useful for search inputs.
 *
 *   const [search, setSearch] = useState("");
 *   const dq = useDebounced(search, 300);
 *   useEffect(() => { fetchSomething(dq); }, [dq]);
 */
export default function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
