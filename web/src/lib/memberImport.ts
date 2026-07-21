import * as XLSX from 'xlsx';
import {
  enforceWorkbookFileGuards,
  enforceWorkbookStructureGuards,
  getMemberImportRowLimit
} from '@/lib/workbookSecurity';

export type MemberImportRow = Record<string, string | number | boolean | null | undefined>;

export type ParsedMemberRow = {
  firstName?: string;
  lastName?: string;
  cmaNumber?: string;
  phone1?: string;
  phone2?: string;
  emailHome?: string;
  emailWork?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  chapterNumber?: string;
  chapterName?: string;
  chapterId?: string;
  status?: string;
  spouseName?: string;
  spouseCmaNumber?: string;
  spouseCellPhone?: string;
  spouseEmail?: string;
  childrenNames?: string;
  grandchildrenNames?: string;
  memberSinceYear?: string;
  spouseMemberSinceYear?: string;
  yearsInChapter?: string;
  spouseYearsInChapter?: string;
  milesToMeetings?: string;
  churchName?: string;
  ministryHow?: string;
  comments?: string;
  rescueEquipment?: string;
  lodging?: string;
  activeInMinistry?: boolean | string;
  wantsEventContact?: boolean | string;
  willingHostBibleStudy?: boolean | string;
  willingHostFellowship?: boolean | string;
  willingPrayerLineEmail?: boolean | string;
  willingRunForSonHelp?: boolean | string;
  belongsOtherMotoOrg?: boolean | string;
  holdsOfficeOtherOrgs?: boolean | string;
  msfCourseSelf?: boolean | string;
  msfCourseSpouse?: boolean | string;
  hasMotorcycleInsurance?: boolean | string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return undefined;
  if (['y', 'yes', 'true', '1', 'x', 'checked'].includes(text)) return true;
  if (['n', 'no', 'false', '0'].includes(text)) return false;
  return undefined;
}

const headerAliases: Record<string, string[]> = {
  firstName: ['firstname', 'first', 'first_name', 'givenname'],
  lastName: ['lastname', 'last', 'last_name', 'surname', 'familyname'],
  cmaNumber: ['cmanumber', 'cma', 'cmano', 'membershipnumber', 'membernumber', 'number'],
  phone1: ['phone1', 'phone', 'homephone', 'primaryphone', 'cellphone'],
  phone2: ['phone2', 'altphone', 'secondaryphone', 'workphone'],
  emailHome: ['emailhome', 'homeemail', 'email', 'emailaddress'],
  emailWork: ['emailwork', 'workemail'],
  address1: ['address1', 'address', 'street', 'streetaddress'],
  address2: ['address2', 'apt', 'suite', 'unit'],
  city: ['city'],
  state: ['state', 'province'],
  zipCode: ['zipcode', 'zip', 'postalcode', 'postcode'],
  country: ['country'],
  chapterNumber: ['chapternumber', 'chapterno', 'chapter'],
  chapterName: ['chaptername'],
  chapterId: ['chapterid'],
  status: ['status', 'memberstatus'],
  spouseName: ['spousename'],
  spouseCmaNumber: ['spousecmanumber'],
  spouseCellPhone: ['spousecellphone', 'spousephone'],
  spouseEmail: ['spouseemail'],
  childrenNames: ['children', 'childrennames'],
  grandchildrenNames: ['grandchildren', 'grandchildrennames'],
  memberSinceYear: ['membersinceyear', 'membersince'],
  spouseMemberSinceYear: ['spousemembersinceyear', 'spousemembersince'],
  yearsInChapter: ['yearsinchapter'],
  spouseYearsInChapter: ['spouseyearsinchapter'],
  milesToMeetings: ['milestomeetings'],
  churchName: ['churchname'],
  ministryHow: ['ministryhow'],
  comments: ['comments', 'notes'],
  rescueEquipment: ['rescueequipment'],
  lodging: ['lodging'],
  activeInMinistry: ['activeinministry'],
  wantsEventContact: ['wantseventcontact'],
  willingHostBibleStudy: ['willinghostbiblestudy'],
  willingHostFellowship: ['willinghostfellowship'],
  willingPrayerLineEmail: ['willingprayerlineemail'],
  willingRunForSonHelp: ['willingrunforsonhelp'],
  belongsOtherMotoOrg: ['belongsothermotoorg'],
  holdsOfficeOtherOrgs: ['holdsofficeotherorgs'],
  msfCourseSelf: ['msfcourseself'],
  msfCourseSpouse: ['msfcoursespouse'],
  hasMotorcycleInsurance: ['hasmotorcycleinsurance']
};

export async function parseMemberImportFile(file: File): Promise<ParsedMemberRow[]> {
  enforceWorkbookFileGuards(file);

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];

  enforceWorkbookStructureGuards({
    sheetCount: workbook.SheetNames.length,
    rowCount: 0,
    maxRows: getMemberImportRowLimit(),
    contextLabel: 'member-import'
  });

  if (!firstSheet) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  enforceWorkbookStructureGuards({
    sheetCount: workbook.SheetNames.length,
    rowCount: rawRows.length,
    maxRows: getMemberImportRowLimit(),
    contextLabel: 'member-import'
  });

  if (rawRows.length === 0) {
    return [];
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const headerIndex = new Map<string, string>();

  for (let index = 0; index < headers.length; index += 1) {
    headerIndex.set(normalizedHeaders[index], headers[index]);
  }

  return rawRows.map((row) => {
    const mapped: ParsedMemberRow = {};

    for (const [targetField, aliases] of Object.entries(headerAliases)) {
      const sourceHeader = aliases
        .map((alias) => headerIndex.get(normalizeHeader(alias)))
        .find((value) => typeof value === 'string');

      if (!sourceHeader) continue;

      const value = row[sourceHeader];
      if (typeof value === 'string' || typeof value === 'number') {
        mapped[targetField as keyof ParsedMemberRow] = normalizeValue(value) as any;
      } else if (typeof value === 'boolean') {
        mapped[targetField as keyof ParsedMemberRow] = value as any;
      }
    }

    return mapped;
  });
}

export function toBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  return parseBoolean(value) ?? false;
}

export function toNullableString(value: unknown) {
  const normalized = normalizeValue(value);
  return typeof normalized === 'string' ? normalized : null;
}
