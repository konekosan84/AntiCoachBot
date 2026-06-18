import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

/**
 * Generic sortable-table hook.
 *
 *   const { sortedData, sortKey, sortDir, toggle } = useSortable(data, "name");
 *   <th onClick={() => toggle("name")}>Имя <SortIcon active={sortKey==="name"} dir={sortDir} /></th>
 */
export default function useSortable(data, initialKey = null, initialDir = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialDir);

  function toggle(key) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !Array.isArray(data)) return data;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;       // nulls last
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv), "ru", { sensitivity: "base" }) * mul;
    });
  }, [data, sortKey, sortDir]);

  return { sortedData, sortKey, sortDir, toggle };
}

/**
 * Small sort indicator for table header cells.
 */
export function SortIcon({ active, dir }) {
  const color = active ? "#3acfd5" : "var(--text-muted)";
  if (!active) return <ChevronsUpDown size={12} color={color} style={{ marginLeft: 4, verticalAlign: "middle", opacity: 0.6 }} />;
  return dir === "asc"
    ? <ChevronUp   size={12} color={color} style={{ marginLeft: 4, verticalAlign: "middle" }} />
    : <ChevronDown size={12} color={color} style={{ marginLeft: 4, verticalAlign: "middle" }} />;
}
