export type DirectoryOptionalFieldKey =
  | 'address2'
  | 'emailHome'
  | 'emailWork'
  | 'status'
  | 'spouseName'
  | 'spouseCmaNumber'
  | 'spouseCellPhone'
  | 'spouseEmail'
  | 'childrenNames'
  | 'grandchildrenNames'
  | 'memberSinceYear'
  | 'spouseMemberSinceYear'
  | 'yearsInChapter'
  | 'spouseYearsInChapter'
  | 'milesToMeetings'
  | 'churchName'
  | 'activeInMinistry'
  | 'ministryHow'
  | 'wantsEventContact'
  | 'willingHostBibleStudy'
  | 'willingHostFellowship'
  | 'willingPrayerLineEmail'
  | 'willingRunForSonHelp'
  | 'belongsOtherMotoOrg'
  | 'holdsOfficeOtherOrgs'
  | 'yearsRidingSelf'
  | 'msfCourseSelf'
  | 'yearsRidingSpouse'
  | 'msfCourseSpouse'
  | 'comments'
  | 'rescueEquipment'
  | 'lodging';

export type MemberDirectoryField = {
  key: string;
  label: string;
  value: string;
};

export type MemberDirectoryConfig = {
  optionalFields: DirectoryOptionalFieldKey[];
};

export const DEFAULT_DIRECTORY_FIELDS = ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode', 'phone1', 'phone2'] as const;

export const OPTIONAL_DIRECTORY_FIELD_DEFINITIONS: Array<{ key: DirectoryOptionalFieldKey; label: string }> = [
  { key: 'address2', label: 'Street Address 2' },
  { key: 'emailHome', label: 'Home Email' },
  { key: 'emailWork', label: 'Work Email' },
  { key: 'status', label: 'Status' },
  { key: 'spouseName', label: 'Spouse Name' },
  { key: 'spouseCmaNumber', label: 'Spouse CMA Number' },
  { key: 'spouseCellPhone', label: 'Spouse Phone' },
  { key: 'spouseEmail', label: 'Spouse Email' },
  { key: 'childrenNames', label: 'Children' },
  { key: 'grandchildrenNames', label: 'Grandchildren' },
  { key: 'memberSinceYear', label: 'Member Since Year' },
  { key: 'spouseMemberSinceYear', label: 'Spouse Member Since Year' },
  { key: 'yearsInChapter', label: 'Years in Chapter' },
  { key: 'spouseYearsInChapter', label: 'Spouse Years in Chapter' },
  { key: 'milesToMeetings', label: 'Miles to Meetings' },
  { key: 'churchName', label: 'Church Name' },
  { key: 'activeInMinistry', label: 'Active in Ministry' },
  { key: 'ministryHow', label: 'Ministry How' },
  { key: 'wantsEventContact', label: 'Wants Event Contact' },
  { key: 'willingHostBibleStudy', label: 'Will Host Bible Study' },
  { key: 'willingHostFellowship', label: 'Will Host Fellowship' },
  { key: 'willingPrayerLineEmail', label: 'Prayer Line Email' },
  { key: 'willingRunForSonHelp', label: 'Run For Son Help' },
  { key: 'belongsOtherMotoOrg', label: 'Other Moto Org' },
  { key: 'holdsOfficeOtherOrgs', label: 'Other Orgs Office' },
  { key: 'yearsRidingSelf', label: 'Years Riding Self' },
  { key: 'msfCourseSelf', label: 'MSF Course Self' },
  { key: 'yearsRidingSpouse', label: 'Years Riding Spouse' },
  { key: 'msfCourseSpouse', label: 'MSF Course Spouse' },
  { key: 'comments', label: 'Comments' },
  { key: 'rescueEquipment', label: 'Rescue Equipment' },
  { key: 'lodging', label: 'Lodging' }
];

const optionalFieldKeySet = new Set<DirectoryOptionalFieldKey>(OPTIONAL_DIRECTORY_FIELD_DEFINITIONS.map((field) => field.key));

function normalizeString(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return normalizeString(String(value));
}

function toBoolText(value: unknown) {
  return stringifyValue(value);
}

export function getDefaultMemberDirectoryConfig(): MemberDirectoryConfig {
  return { optionalFields: [] };
}

export function normalizeMemberDirectoryConfig(value: unknown): MemberDirectoryConfig {
  if (!value || typeof value !== 'object') {
    return getDefaultMemberDirectoryConfig();
  }

  const candidate = value as { optionalFields?: unknown };
  const optionalFields = Array.isArray(candidate.optionalFields)
    ? candidate.optionalFields
        .map((field) => normalizeString(field).trim())
        .filter((field): field is DirectoryOptionalFieldKey => optionalFieldKeySet.has(field as DirectoryOptionalFieldKey))
    : [];

  return { optionalFields: Array.from(new Set(optionalFields)) };
}

export function normalizeHiddenDirectoryFields(value: unknown): DirectoryOptionalFieldKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((field) => normalizeString(field))
      .filter((field): field is DirectoryOptionalFieldKey => optionalFieldKeySet.has(field as DirectoryOptionalFieldKey))
  ));
}

function getCityStateZip(member: Record<string, unknown>) {
  const city = normalizeString(member.city);
  const state = normalizeString(member.state);
  const zipCode = normalizeString(member.zipCode);

  const stateZip = [state, zipCode].filter(Boolean).join(' ');
  if (city && stateZip) {
    return `${city}, ${stateZip}`;
  }

  if (city) {
    return city;
  }

  return stateZip;
}

function getFieldValue(member: Record<string, unknown>, key: string) {
  switch (key) {
    case 'firstName':
      return [normalizeString(member.firstName), normalizeString(member.lastName)].filter(Boolean).join(' ');
    case 'lastName':
      return '';
    case 'address1':
      return normalizeString(member.address1);
    case 'city':
      return getCityStateZip(member);
    case 'state':
    case 'zipCode':
      return '';
    case 'phone1':
      return normalizeString(member.phone1);
    case 'phone2':
      return normalizeString(member.phone2);
    case 'memberSinceYear':
      return stringifyValue(member.memberSinceYear);
    case 'spouseMemberSinceYear':
      return stringifyValue(member.spouseMemberSinceYear);
    case 'activeInMinistry':
    case 'wantsEventContact':
    case 'willingHostBibleStudy':
    case 'willingHostFellowship':
    case 'willingPrayerLineEmail':
    case 'willingRunForSonHelp':
    case 'belongsOtherMotoOrg':
    case 'holdsOfficeOtherOrgs':
    case 'msfCourseSelf':
    case 'msfCourseSpouse':
      return toBoolText(member[key]);
    default:
      return normalizeString(member[key]);
  }
}

export function getVisibleDirectoryOptionalFields(member: Record<string, unknown>, config?: MemberDirectoryConfig | null) {
  const hiddenFields = normalizeHiddenDirectoryFields(member.directoryShareHiddenFields);
  const optionalFields = normalizeMemberDirectoryConfig(config).optionalFields;

  return OPTIONAL_DIRECTORY_FIELD_DEFINITIONS
    .filter((field) => optionalFields.includes(field.key) && !hiddenFields.includes(field.key))
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: stringifyValue(member[field.key])
    }))
    .filter((field) => field.value.length > 0);
}

export function buildPublicDirectoryMember(member: Record<string, unknown>, config?: MemberDirectoryConfig | null) {
  const fields: MemberDirectoryField[] = [];

  for (const key of DEFAULT_DIRECTORY_FIELDS) {
    const value = getFieldValue(member, key);
    if (!value) continue;

    const label =
      key === 'address1' ? 'Address' :
      key === 'city' ? 'City, State Zip' :
      key === 'phone1' ? 'Phone1' :
      key === 'phone2' ? 'Phone2' :
      key === 'firstName' ? 'Name' :
      key;

    fields.push({ key, label, value });
  }

  return {
    id: String(member.id ?? ''),
    firstName: normalizeString(member.firstName),
    lastName: normalizeString(member.lastName),
    displayName: [normalizeString(member.firstName), normalizeString(member.lastName)].filter(Boolean).join(' '),
    chapterId: member.chapterId ? String(member.chapterId) : null,
    chapterName: normalizeString(member.chapterName),
    chapterNumber: normalizeString(member.chapterNumber),
    fields,
    optionalFields: getVisibleDirectoryOptionalFields(member, config)
  };
}
