export type ReportQueryValues = Record<string, string | readonly string[] | undefined>;

export function setReportQueryValues(params: URLSearchParams, values: ReportQueryValues) {
  for (const [key, value] of Object.entries(values)) {
    params.delete(key);
    if (typeof value === "string") {
      if (value) params.set(key, value);
    } else {
      for (const item of value ?? []) params.append(key, item);
    }
  }
}

export function reportHref(path: string, values: ReportQueryValues | URLSearchParams = {}) {
  const params = new URLSearchParams();
  if (values instanceof URLSearchParams) {
    values.forEach((value, key) => { params.append(key, value); });
  } else {
    setReportQueryValues(params, values);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function optionValue(value: string | null, options: readonly string[], fallback = "") {
  return value && options.includes(value) ? value : fallback;
}

export function optionValues(params: URLSearchParams, key: string, options: readonly { value: string }[]) {
  const allowed = new Set(options.map(option => option.value));
  return new Set(params.getAll(key).filter(value => value && allowed.has(value)));
}
