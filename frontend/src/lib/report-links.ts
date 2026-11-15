export function reportHref(path: string, values: Record<string, string | undefined> | URLSearchParams = {}) {
  const params = new URLSearchParams();
  if (values instanceof URLSearchParams) {
    values.forEach((value, key) => { params.append(key, value); });
  } else {
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function optionValue(value: string | null, options: readonly string[], fallback = "") {
  return value && options.includes(value) ? value : fallback;
}
