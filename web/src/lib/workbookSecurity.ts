const MAX_WORKBOOK_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_MEMBER_IMPORT_ROWS = 5000;
const MAX_REPORTING_IMPORT_ROWS = 3000;
const MAX_WORKBOOK_SHEETS = 24;

const allowedWorkbookMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]);

function hasAllowedExtension(fileName: string) {
  return /\.(xlsx|xls)$/i.test(fileName);
}

function isAllowedWorkbookMimeType(mimeType: string | undefined) {
  if (!mimeType) {
    return true;
  }

  return allowedWorkbookMimeTypes.has(mimeType);
}

function normalizeFileName(fileName: string) {
  return fileName.replace(/[\r\n\u0000]+/g, '').trim();
}

export function enforceWorkbookFileGuards(file: File) {
  const safeName = normalizeFileName(file.name ?? '');
  if (!safeName || !hasAllowedExtension(safeName)) {
    throw new Error('Only .xlsx or .xls workbook files are allowed.');
  }

  if (!isAllowedWorkbookMimeType(file.type)) {
    throw new Error('Workbook MIME type is not allowed.');
  }

  if (file.size <= 0) {
    throw new Error('Workbook file is empty.');
  }

  if (file.size > MAX_WORKBOOK_FILE_SIZE_BYTES) {
    throw new Error('Workbook exceeds the 2 MB safety limit.');
  }

  return {
    safeName,
    sizeBytes: file.size
  };
}

export function enforceWorkbookStructureGuards(input: {
  sheetCount: number;
  rowCount: number;
  maxRows: number;
  contextLabel: 'member-import' | 'reporting-import';
}) {
  if (input.sheetCount <= 0) {
    throw new Error('Workbook must contain at least one sheet.');
  }

  if (input.sheetCount > MAX_WORKBOOK_SHEETS) {
    throw new Error('Workbook has too many sheets for safe processing.');
  }

  if (input.rowCount > input.maxRows) {
    throw new Error(`Workbook contains too many rows for ${input.contextLabel}.`);
  }
}

export function getWorkbookSecurityLimits() {
  return {
    maxWorkbookFileSizeBytes: MAX_WORKBOOK_FILE_SIZE_BYTES,
    maxMemberImportRows: MAX_MEMBER_IMPORT_ROWS,
    maxReportingImportRows: MAX_REPORTING_IMPORT_ROWS,
    maxWorkbookSheets: MAX_WORKBOOK_SHEETS
  };
}

export function getMemberImportRowLimit() {
  return MAX_MEMBER_IMPORT_ROWS;
}

export function getReportingImportRowLimit() {
  return MAX_REPORTING_IMPORT_ROWS;
}
