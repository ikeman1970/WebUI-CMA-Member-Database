const REGION_NAMES: Record<number, string> = {
  1: 'West',
  2: 'Rocky Mountain',
  3: 'North Central',
  4: 'South Central',
  5: 'Northeast',
  6: 'Southeast'
};

/**
 * CMA USA Regions (6 total)
 * 
 * Region 1 – West Region: Alaska, California, Idaho, Nevada, Oregon, Washington
 * Region 2 – Rocky Mountain Region: Arizona, Colorado, Hawaii, Montana, New Mexico, Utah, Wyoming
 * Region 3 – North Central Region: Illinois, Indiana, Iowa, Michigan, Minnesota, Nebraska, North Dakota, South Dakota, Wisconsin
 * Region 4 – South Central Region: Arkansas, Kansas, Louisiana, Mississippi, Missouri, Oklahoma, Texas
 * Region 5 – Northeast Region: Connecticut, Delaware, Kentucky, Maine, Maryland, Massachusetts, New Hampshire, New Jersey, New York, Ohio, Pennsylvania, Rhode Island, Vermont, Virginia, West Virginia
 * Region 6 – Southeast Region: Alabama, Florida, Georgia, North Carolina, South Carolina, Tennessee
 */
const STATE_TO_REGION: Record<string, number> = {
  // Region 1 - West
  AK: 1,
  CA: 1,
  ID: 1,
  NV: 1,
  OR: 1,
  WA: 1,
  // Region 2 - Rocky Mountain
  AZ: 2,
  CO: 2,
  HI: 2,
  MT: 2,
  NM: 2,
  UT: 2,
  WY: 2,
  // Region 3 - North Central
  IL: 3,
  IN: 3,
  IA: 3,
  MI: 3,
  MN: 3,
  NE: 3,
  ND: 3,
  SD: 3,
  WI: 3,
  // Region 4 - South Central
  AR: 4,
  KS: 4,
  LA: 4,
  MS: 4,
  MO: 4,
  OK: 4,
  TX: 4,
  // Region 5 - Northeast
  CT: 5,
  DE: 5,
  KY: 5,
  ME: 5,
  MD: 5,
  MA: 5,
  NH: 5,
  NJ: 5,
  NY: 5,
  OH: 5,
  PA: 5,
  RI: 5,
  VT: 5,
  VA: 5,
  WV: 5,
  // Region 6 - Southeast
  AL: 6,
  FL: 6,
  GA: 6,
  NC: 6,
  SC: 6,
  TN: 6,
  // District of Columbia (Southeast region)
  DC: 6
};

export function getRegionCodeFromState(state: string | null | undefined): number | null {
  if (!state) return null;
  const normalized = state.trim().toUpperCase();
  return STATE_TO_REGION[normalized] ?? null;
}

export function getRegionName(region: number | null | undefined): string {
  if (!region) return 'Unknown Region';
  return REGION_NAMES[region] ?? `Region ${region}`;
}
