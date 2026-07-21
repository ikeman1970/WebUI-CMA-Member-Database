export type RegionNameMap = Record<string, string>;

export function normalizeRegionCode(value: unknown) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function normalizeRegionNames(value: unknown): RegionNameMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const names: RegionNameMap = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const code = normalizeRegionCode(key);
    if (!code) {
      continue;
    }

    const label = String(rawValue ?? '').trim();
    if (label) {
      names[String(code)] = label;
    }
  }

  return names;
}

export function formatRegionLabel(regionCode: number | null | undefined, names?: RegionNameMap | null) {
  if (!regionCode || !Number.isFinite(regionCode)) {
    return 'Region';
  }

  const customName = names?.[String(regionCode)]?.trim();
  return customName ? `Region ${regionCode} (${customName})` : `Region ${regionCode}`;
}
