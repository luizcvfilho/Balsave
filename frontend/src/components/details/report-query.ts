"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { reportHref } from "../../lib/report-links";

export function useReportQuery() {
  const pathname = usePathname();
  const params = useSearchParams();

  function withQuery(search: string, values: Record<string, string | undefined>) {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return reportHref(pathname, next);
  }

  function href(values: Record<string, string | undefined>) {
    return withQuery(params.toString(), values);
  }

  function update(values: Record<string, string | undefined>) {
    window.history.replaceState(null, "", withQuery(window.location.search, values));
  }

  return { params, href, update };
}
