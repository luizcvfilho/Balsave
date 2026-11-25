"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { reportHref, type ReportQueryValues, setReportQueryValues } from "../../lib/report-links";

export function useReportQuery() {
  const pathname = usePathname();
  const params = useSearchParams();

  function withQuery(search: string, values: ReportQueryValues) {
    const next = new URLSearchParams(search);
    setReportQueryValues(next, values);
    return reportHref(pathname, next);
  }

  function href(values: ReportQueryValues) {
    return withQuery(params.toString(), values);
  }

  function update(values: ReportQueryValues) {
    window.history.replaceState(null, "", withQuery(window.location.search, values));
  }

  return { params, href, update };
}
