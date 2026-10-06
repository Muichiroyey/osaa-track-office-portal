import { useMemo } from "react";
import SearchableSelect from "./SearchableSelect.jsx";

/** The key a post is filed under: its posting office, or "saa" for the SAA office's own posts. */
export function authorKey(post) {
  return post.author_type === "office" ? `office-${post.author_office_id}` : "saa";
}

/**
 * Search bar + drop-down to show only the posts of one office. The list is
 * built from the posts themselves, so it only ever offers offices that have
 * actually posted. "All offices" (the default) shows everything.
 */
export default function OfficeFeedFilter({ items, value, onChange }) {
  const options = useMemo(() => {
    const seen = new Map();
    for (const post of items) if (!seen.has(authorKey(post))) seen.set(authorKey(post), post.author_name);
    const rest = [...seen.entries()]
      .map(([key, label]) => ({ value: key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "all", label: "All offices" }, ...rest];
  }, [items]);

  return (
    <div className="mb-4">
      <SearchableSelect options={options} value={value} onChange={(v) => onChange(v || "all")} placeholder="Search posts by office..." />
    </div>
  );
}
