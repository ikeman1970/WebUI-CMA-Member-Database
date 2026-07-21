const XLSX = require('xlsx');
const path = '/Users/reichelberger/Library/Mobile Documents/com~apple~CloudDocs/VSCode_Projects/WebUI_CMA Member DataBase/CMADirectory/Sign-In Sheet June 2026(Filled).xlsx';

const wb = XLSX.readFile(path);
const memberSheetPattern = /^Members\s*\d+$/i;
const memberSheetNames = wb.SheetNames.filter((sheetName) => memberSheetPattern.test(sheetName));

console.log('=== Sheet Detection ===');
console.log('Matched member sheets:', memberSheetNames);

const firstSheet = wb.Sheets[memberSheetNames[0]];
const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null, blankrows: false, raw: false });

console.log('\n=== Date Parsing ===');
const dateValue = firstRows[1]?.[1];
console.log('Raw date value:', dateValue);

const text = String(dateValue ?? '').trim();
const titleMatch = text.match(/date:\s*(.+)$/i);
const candidate = titleMatch ? titleMatch[1] : text;
console.log('Candidate:', candidate);

const parsed = new Date(candidate);
const isValid = !Number.isNaN(parsed.getTime());
console.log('Parsed:', parsed.toISOString());
console.log('Is valid:', isValid);
console.log('Month (0-based):', parsed.getUTCMonth());

console.log('\n=== Column Detection ===');
const headerRow = firstRows[2] ?? [];
const maxColumns = Math.max(headerRow.length, firstRows[1].length);
console.log('Max columns:', maxColumns);

let columnCount = 0;
for (let i = 4; i < maxColumns; i++) {
  const header = headerRow[i];
  if (header && String(header).trim()) columnCount++;
}
console.log('Non-empty headers from index 4:', columnCount);

console.log('\n=== Data Row Detection ===');
let dataRowCount = 0;
for (let rowIndex = 3; rowIndex < Math.min(firstRows.length, 20); rowIndex++) {
  const row = firstRows[rowIndex] ?? [];
  const attendeeName = String(row[1] ?? '').trim();
  const memberNumber = String(row[2] ?? '').trim();
  if (attendeeName || memberNumber) {
    dataRowCount++;
    if (dataRowCount <= 3) {
      console.log(`Row ${rowIndex}: "${attendeeName}" / "${memberNumber}"`);
    }
  }
}
console.log('Total data rows (first 17):', dataRowCount);

console.log('\n=== Sample Metrics ===');
let sampleMetrics = 0;
for (let rowIndex = 3; rowIndex < Math.min(firstRows.length, 20); rowIndex++) {
  const row = firstRows[rowIndex] ?? [];
  for (let colIndex = 4; colIndex < Math.min(headerRow.length, 25); colIndex++) {
    const val = row[colIndex];
    if (val && (typeof val === 'number' || /[✔✓]/.test(String(val)))) {
      sampleMetrics++;
      if (sampleMetrics <= 5) {
        console.log(`  Row ${rowIndex}, Col ${colIndex} (${headerRow[colIndex]}): ${val}`);
      }
    }
  }
}
console.log('Total metric values found:', sampleMetrics);
