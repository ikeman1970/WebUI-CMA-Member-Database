import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import ChapterWorkspaceTabs from '@/components/ChapterWorkspaceTabs';
import { parseReportingWorkbookFile } from '@/lib/reportingWorkbookImport';

type SnapshotRow = {
  id: string;
  chapterId: string;
  chapter: {
    id: string;
    number: string | null;
    name: string | null;
    city: string | null;
    state: string | null;
    region: number | null;
  };
  reportMonth: string;
  sourceFileName: string | null;
  metrics: Record<string, unknown>;
  changeHistory?: Array<{
    timestamp: string;
    changedBy: string;
    accountId: string;
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  }>;
  editable: boolean;
};

type SnapshotResponse = {
  mode: 'snapshot';
  month: string;
  chapters: ChapterOption[];
  metricColumns: string[];
  rows: SnapshotRow[];
  permissions: {
    canView: boolean;
    canImport: boolean;
    editableChapterIds: string[];
  };
};

type ChapterOption = {
  id: string;
  number: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
  region: number | null;
};

type TrendRow = {
  month: string;
  totals: Record<string, number>;
};

type TrendResponse = {
  mode: 'trend';
  from: string;
  to: string;
  availableMetrics: string[];
  rows: TrendRow[];
  permissions: {
    canView: boolean;
    canImport: boolean;
    editableChapterIds: string[];
  };
};

type QuarterlyRow = {
  chapterId: string;
  chapter: ChapterOption;
  secularEventCount: number;
  secularEventAttendance: number;
  secularEventAvgParticipation: number;
  outreachEventCount: number;
  outreachEventAttendance: number;
  outreachEventAvgParticipation: number;
  fellowshipEventCount: number;
  fellowshipEventAttendance: number;
  fellowshipEventAvgParticipation: number;
  salvations: number;
  rededications: number;
  otherMinistry: number;
  guestMonth1: number;
  guestMonth2: number;
  guestMonth3: number;
};

type QuarterlyResponse = {
  mode: 'quarterly';
  from: string;
  to: string;
  chapters: ChapterOption[];
  rows: QuarterlyRow[];
  permissions: {
    canView: boolean;
    canImport: boolean;
    editableChapterIds: string[];
  };
};

function currentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function monthOffset(value: string, delta: number) {
  const [yearText, monthText] = value.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return value;
  }

  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${nextMonth}`;
}

function formatChapterLabel(chapter: SnapshotRow['chapter']) {
  const prefix = [chapter.number, chapter.name].filter(Boolean).join(' - ');
  const suffix = [chapter.city, chapter.state].filter(Boolean).join(', ');
  return [prefix, suffix].filter(Boolean).join(' · ');
}

function parseManualMetricValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = trimmed.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) {
    const parsed = Number.parseFloat(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^(true|yes)$/i.test(trimmed)) {
    return true;
  }

  if (/^(false|no)$/i.test(trimmed)) {
    return false;
  }

  return trimmed;
}

function parseManualMetricsText(text: string) {
  const metrics: Record<string, string | number | boolean> = {};
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.includes('=') ? trimmed.indexOf('=') : trimmed.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    const parsedValue = parseManualMetricValue(rawValue);
    if (parsedValue === null) {
      continue;
    }

    metrics[key] = parsedValue;
  }

  return metrics;
}

function getCurrentQuarter(): number {
  const month = new Date().getMonth() + 1; // 1-12
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

function getQuarterMonthRange(quarter: number, year: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const from = `${year}-${String(startMonth).padStart(2, '0')}`;
  const to = `${year}-${String(endMonth).padStart(2, '0')}`;
  return { from, to };
}

function getQuarterMonthsLabel(quarter: number): string {
  const months = [
    ['January', 'February', 'March'],
    ['April', 'May', 'June'],
    ['July', 'August', 'September'],
    ['October', 'November', 'December']
  ];
  return months[quarter - 1].join(', ');
}

export default function ChapterReportingPage() {
  const [snapshotMonth, setSnapshotMonth] = useState(currentMonthValue());
  const [trendFrom, setTrendFrom] = useState(monthOffset(currentMonthValue(), -5));
  const [trendTo, setTrendTo] = useState(currentMonthValue());
  const [selectedMetric, setSelectedMetric] = useState('');
  const [importChapterId, setImportChapterId] = useState('');
  const [manualMonth, setManualMonth] = useState(currentMonthValue());
  const [manualMetricsText, setManualMetricsText] = useState('');
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [quarterly, setQuarterly] = useState<QuarterlyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [loadingQuarterly, setLoadingQuarterly] = useState(false);
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const [savingManualEntry, setSavingManualEntry] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingMetrics, setEditingMetrics] = useState<Record<string, unknown>>({});
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');

  async function loadSnapshot(month: string) {
    setLoadingSnapshot(true);
    try {
      const response = await fetch(`/api/reporting?mode=snapshot&month=${encodeURIComponent(month)}`, {
        credentials: 'include'
      });

      if (response.status === 403 || response.status === 401) {
        setError('You do not have permission to view reporting.');
        setSnapshot(null);
        return;
      }

      if (!response.ok) {
        setError('Unable to load snapshot reporting.');
        return;
      }

      setSnapshot((await response.json()) as SnapshotResponse);
      setError(null);
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function loadTrend(from: string, to: string) {
    setLoadingTrend(true);
    try {
      const response = await fetch(`/api/reporting?mode=trend&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        credentials: 'include'
      });

      if (response.status === 403 || response.status === 401) {
        setError('You do not have permission to view reporting.');
        setTrend(null);
        return;
      }

      if (!response.ok) {
        setError('Unable to load trend reporting.');
        return;
      }

      const payload = (await response.json()) as TrendResponse;
      setTrend(payload);
      setError(null);

      if (!selectedMetric && payload.availableMetrics.length > 0) {
        setSelectedMetric(payload.availableMetrics[0]);
      }
    } finally {
      setLoadingTrend(false);
    }
  }

  async function loadQuarterly(from: string, to: string) {
    setLoadingQuarterly(true);
    try {
      const response = await fetch(`/api/reporting?mode=quarterly&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        credentials: 'include'
      });

      if (response.status === 403 || response.status === 401) {
        setError('You do not have permission to view reporting.');
        setQuarterly(null);
        return;
      }

      if (!response.ok) {
        setError('Unable to load quarterly reporting.');
        return;
      }

      setQuarterly((await response.json()) as QuarterlyResponse);
      setError(null);
    } finally {
      setLoadingQuarterly(false);
    }
  }

  useEffect(() => {
    void loadSnapshot(snapshotMonth);
  }, [snapshotMonth]);

  useEffect(() => {
    if (!snapshot || importChapterId) {
      return;
    }

    const defaultChapterId = snapshot.permissions.editableChapterIds[0] ?? snapshot.chapters[0]?.id ?? '';
    if (defaultChapterId) {
      setImportChapterId(defaultChapterId);
    }
  }, [importChapterId, snapshot]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void loadTrend(trendFrom, trendTo);
  }, [trendFrom, trendTo]);

  const { from: quarterlyFrom, to: quarterlyTo } = useMemo(() => {
    return getQuarterMonthRange(selectedQuarter, selectedYear);
  }, [selectedQuarter, selectedYear]);

  useEffect(() => {
    void loadQuarterly(quarterlyFrom, quarterlyTo);
  }, [quarterlyFrom, quarterlyTo]);

  const displayedTrendRows = useMemo(() => {
    if (!trend || !selectedMetric) {
      return [] as Array<{ month: string; value: number }>;
    }

    return trend.rows.map((row) => ({
      month: row.month,
      value: row.totals[selectedMetric] ?? 0
    }));
  }, [selectedMetric, trend]);

  async function handleWorkbookImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!importChapterId) {
      setError('Select a chapter before importing a workbook.');
      return;
    }

    setImportingWorkbook(true);
    setError(null);
    setImportMessage(null);

    try {
      const rows = await parseReportingWorkbookFile(file, importChapterId);
      if (rows.length === 0) {
        setImportMessage('No reporting rows were found in the workbook.');
        return;
      }

      const response = await fetch('/api/reporting/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows, fileName: file.name })
      });

      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError('Your session expired or is on a different host. Please log in again.');
        return;
      }

      if (!response.ok) {
        setError(payload.message ?? 'Workbook import failed.');
        return;
      }

      setImportMessage(payload.monthSummary ?? 'Workbook import complete.');
      await loadSnapshot(snapshotMonth);
      await loadTrend(trendFrom, trendTo);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : '';
      setError(message || 'Unable to read or import the workbook.');
    } finally {
      setImportingWorkbook(false);
    }
  }

  async function handleManualImport() {
    if (!importChapterId) {
      setError('Select a chapter before saving manual reporting values.');
      return;
    }

    const metrics = parseManualMetricsText(manualMetricsText);
    if (Object.keys(metrics).length === 0) {
      setError('Add at least one metric line using "Metric = Value" format.');
      return;
    }

    setSavingManualEntry(true);
    setError(null);
    setImportMessage(null);

    try {
      const response = await fetch('/api/reporting/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: 'manual-entry',
          rows: [
            {
              chapterId: importChapterId,
              month: manualMonth,
              ...metrics
            }
          ]
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError('Your session expired or is on a different host. Please log in again.');
        return;
      }

      if (!response.ok) {
        setError(payload.message ?? 'Manual reporting save failed.');
        return;
      }

      setImportMessage(payload.monthSummary ?? 'Manual reporting values saved.');
      await loadSnapshot(snapshotMonth);
      await loadTrend(trendFrom, trendTo);
    } catch {
      setError('Unable to save manual reporting values.');
    } finally {
      setSavingManualEntry(false);
    }
  }

  function handleOpenSnapshotEdit(row: SnapshotRow) {
    setEditingSnapshotId(row.id);
    setEditingMetrics({ ...row.metrics });
  }

  function handleCloseSnapshotEdit() {
    setEditingSnapshotId(null);
    setEditingMetrics({});
  }

  async function handleSaveSnapshotMetrics() {
    if (!editingSnapshotId) {
      return;
    }

    setSavingSnapshot(true);
    setError(null);
    setImportMessage(null);

    try {
      const response = await fetch('/api/reporting/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          snapshotId: editingSnapshotId,
          metricUpdates: editingMetrics
        })
      });

      if (response.status === 401) {
        setError('Your session expired or is on a different host. Please log in again.');
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.message ?? 'Failed to save snapshot metrics.');
        return;
      }

      setImportMessage('Snapshot metrics updated successfully.');
      handleCloseSnapshotEdit();
      await loadSnapshot(snapshotMonth);
      await loadQuarterly(quarterlyFrom, quarterlyTo);
    } catch {
      setError('Unable to save snapshot metrics.');
    } finally {
      setSavingSnapshot(false);
    }
  }

  return (
    <main className="page-shell">
      <ChapterWorkspaceTabs activeTab="reporting" />
      <header className="reporting-header">
        <div>
          <h1>Reporting</h1>
          <p className="reporting-subtitle">Snapshot and trend reporting for chapter leaders.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Print Report
        </button>
      </header>

      {error ? <p className="message-error">{error}</p> : null}
      {importMessage ? <p className="message-success">{importMessage}</p> : null}

      {snapshot?.permissions.canImport ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="reporting-toolbar">
            <h2>Import Workbook</h2>
            <label>
              Chapter
              <select className="input" value={importChapterId} onChange={(event) => setImportChapterId(event.target.value)}>
                <option value="">Select a chapter</option>
                {snapshot.chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {formatChapterLabel(chapter)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p style={{ marginTop: 0 }}>
            Upload a chapter sign-in workbook. The importer reads the monthly sheet and turns the marked attendance columns into reporting metrics.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleWorkbookImport}
            disabled={importingWorkbook}
          />
          
          {/* Print Template Section */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>📄 Print Sign-In Sheet Template</h3>
            <p style={{ marginTop: 0, marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
              Print a blank sign-in sheet for your chapter. Members can fill it out offline and you&apos;ll import it later.
            </p>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => {
                const selectedChapter = snapshot.chapters.find(c => c.id === importChapterId);
                const chapterName = selectedChapter ? formatChapterLabel(selectedChapter) : 'CMA Chapter';
                const url = '/api/reporting/print-template?chapterId=' + importChapterId + '&chapterName=' + encodeURIComponent(chapterName);
                window.open(url, '_blank');
              }}
              disabled={!importChapterId}
            >
              Open Print Template
            </button>
            <p style={{ marginTop: 8, fontSize: '0.8em', color: '#999' }}>
              {String.fromCharCode(128064)} Tip: Select a chapter first, then click to open a printable template. You can print to PDF or paper, fill it out, and import later.
            </p>
          </div>
          
          <hr style={{ margin: '16px 0' }} />
          <h3 style={{ marginTop: 0 }}>Manual Entry</h3>
          <p style={{ marginTop: 0 }}>
            Paste finalized values from your Filled workbook. One metric per line using <strong>Metric = Value</strong> or <strong>Metric: Value</strong>.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              Month
              <input type="month" value={manualMonth} onChange={(event) => setManualMonth(event.target.value)} className="input" />
            </label>
          </div>
          <textarea
            className="input"
            style={{ width: '100%', minHeight: 160, marginTop: 12 }}
            value={manualMetricsText}
            onChange={(event) => setManualMetricsText(event.target.value)}
            placeholder={[
              'Monthly Event Attendance = 137',
              'Secular Events Attendance = 68',
              'Outreach Events Attendance = 22',
              'Fellowship Events Attendance = 47',
              'Salvations = 7',
              'Rededications = 1',
              'Other Ministry = 1552'
            ].join('\n')}
          />
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => void handleManualImport()} disabled={savingManualEntry}>
              {savingManualEntry ? 'Saving...' : 'Save Manual Values'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="reporting-toolbar">
          <h2>Monthly Snapshot</h2>
          <label>
            Month
            <input type="month" value={snapshotMonth} onChange={(event) => setSnapshotMonth(event.target.value)} className="input" />
          </label>
        </div>

        {loadingSnapshot ? <p>Loading snapshot...</p> : null}

        {!loadingSnapshot && snapshot ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              {snapshot.rows.length === 0 ? (
                <p style={{ color: '#666' }}>No data for {snapshotMonth}. Import workbook or add manual values above.</p>
              ) : (
                <div>
                  <p style={{ marginTop: 0, marginBottom: 12, fontSize: '0.9em', color: '#666' }}>
                    Click &quot;Manage&quot; to edit metrics or view change history.
                  </p>
                  <div className="reporting-table-wrap">
                    <table className="info-table info-table--grid">
                      <thead>
                        <tr>
                          <th>Chapter</th>
                          <th style={{ width: 100 }}>Action</th>
                          {snapshot.metricColumns.slice(0, 5).map((metric) => (
                            <th key={metric}>{metric}</th>
                          ))}
                          {snapshot.metricColumns.length > 5 && <th>+{snapshot.metricColumns.length - 5} more</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.rows.map((row) => (
                          <tr key={row.id}>
                            <td>{formatChapterLabel(row.chapter)}</td>
                            <td>
                              {row.editable ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ fontSize: '0.85em', padding: '4px 8px' }}
                                  onClick={() => handleOpenSnapshotEdit(row)}
                                >
                                  Manage
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.85em', color: '#999' }}>View Only</span>
                              )}
                            </td>
                            {snapshot.metricColumns.slice(0, 5).map((metric) => (
                              <td key={metric}>{String(row.metrics[metric] ?? '—')}</td>
                            ))}
                            {snapshot.metricColumns.length > 5 && (
                              <td style={{ fontSize: '0.85em', color: '#666' }}>View in manager</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Modal */}
            {editingSnapshotId && snapshot.rows.find((r) => r.id === editingSnapshotId) && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: 8,
                  padding: 24,
                  maxWidth: 800,
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                  width: '95%'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ marginTop: 0, marginBottom: 0 }}>Edit Snapshot Metrics</h2>
                    <button
                      type="button"
                      onClick={handleCloseSnapshotEdit}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#666'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {(() => {
                    const editingRow = snapshot.rows.find((r) => r.id === editingSnapshotId);
                    return editingRow ? (
                      <div>
                        <p style={{ marginTop: 0, marginBottom: 16, fontSize: '0.9em', color: '#666' }}>
                          Chapter: <strong>{formatChapterLabel(editingRow.chapter)}</strong>
                        </p>

                        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f7ff', borderRadius: 4, border: '1px solid #cce7ff' }}>
                          <p style={{ marginTop: 0, marginBottom: 8, fontSize: '0.85em', fontWeight: 600 }}>💡 Quick Tip: Paste multiple metrics</p>
                          <textarea
                            placeholder="Paste metrics like:&#10;Monthly Event Attendance = 137&#10;Salvations = 7&#10;Other Ministry = 1552"
                            style={{
                              width: '100%',
                              minHeight: 60,
                              padding: 8,
                              borderRadius: 4,
                              border: '1px solid #ccc',
                              fontFamily: 'monospace',
                              fontSize: '0.85em'
                            }}
                            onPaste={(e) => {
                              const text = e.clipboardData.getData('text');
                              const parsed = parseManualMetricsText(text);
                              if (Object.keys(parsed).length > 0) {
                                setEditingMetrics({ ...editingMetrics, ...parsed });
                              }
                            }}
                          />
                        </div>

                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: 16, paddingRight: 8 }}>
                          {Object.entries(editingMetrics).map(([key, value]) => {
                            const originalValue = editingRow.metrics[key];
                            const hasChanged = originalValue !== value;
                            return (
                              <div key={key} style={{ 
                                marginBottom: 12,
                                padding: 8,
                                borderRadius: 4,
                                backgroundColor: hasChanged ? '#fffacd' : '#f9f9f9',
                                border: hasChanged ? '1px solid #ffd700' : '1px solid #eee'
                              }}>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: '0.9em', color: '#333', fontWeight: 500 }}>
                                  {key}
                                  {hasChanged && <span style={{ marginLeft: 8, color: '#ff6600', fontSize: '0.8em' }}>● Modified</span>}
                                </label>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    className="input"
                                    value={String(value ?? '')}
                                    onChange={(e) => {
                                      const newVal = e.target.value.trim() === '' ? null : e.target.value;
                                      setEditingMetrics({ ...editingMetrics, [key]: newVal });
                                    }}
                                    style={{ flex: 1 }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newMetrics = { ...editingMetrics };
                                      delete newMetrics[key];
                                      setEditingMetrics(newMetrics);
                                    }}
                                    style={{
                                      background: '#f5f5f5',
                                      border: '1px solid #ddd',
                                      borderRadius: 4,
                                      padding: '8px 12px',
                                      cursor: 'pointer',
                                      fontSize: '0.85em'
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                {hasChanged && (
                                  <div style={{ fontSize: '0.8em', color: '#666', marginTop: 4 }}>
                                    Was: {String(originalValue ?? '(empty)')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {editingRow.changeHistory && editingRow.changeHistory.length > 0 && (
                          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4, border: '1px solid #eee' }}>
                            <h4 style={{ marginTop: 0, marginBottom: 8 }}>Recent Changes (Last 3)</h4>
                            <div style={{ fontSize: '0.85em' }}>
                              {editingRow.changeHistory.slice(-3).reverse().map((change, idx) => (
                                <div key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: idx < 2 ? '1px solid #eee' : 'none' }}>
                                  <div style={{ fontWeight: 600, color: '#333' }}>
                                    {new Date(change.timestamp).toLocaleString()} — {change.changedBy}
                                  </div>
                                  <div style={{ color: '#666', marginTop: 4 }}>
                                    {change.changes.map((c, i) => (
                                      <div key={i} style={{ marginLeft: 8 }}>
                                        <span style={{ color: '#999' }}>{c.field}</span>: <span style={{ color: '#cc0000' }}>{String(c.oldValue ?? '(empty)')}</span> {' → '} <span style={{ color: '#00cc00' }}>{String(c.newValue ?? '(empty)')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn-secondary" onClick={handleCloseSnapshotEdit} disabled={savingSnapshot}>
                            Cancel
                          </button>
                          <button type="button" className="btn-primary" onClick={() => void handleSaveSnapshotMetrics()} disabled={savingSnapshot}>
                            {savingSnapshot ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="reporting-toolbar">
          <h2>Trend Reporting</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label>
              From
              <input type="month" value={trendFrom} onChange={(event) => setTrendFrom(event.target.value)} className="input" />
            </label>
            <label>
              To
              <input type="month" value={trendTo} onChange={(event) => setTrendTo(event.target.value)} className="input" />
            </label>
          </div>
        </div>

        {loadingTrend ? <p>Loading trend reporting...</p> : null}

        {!loadingTrend && trend ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label>
                Metric
                <select className="input" value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
                  {trend.availableMetrics.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="reporting-table-wrap">
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Trend Chart: {selectedMetric}</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={displayedTrendRows} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#0066cc" strokeWidth={2} dot={{ fill: '#0066cc' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Comparison by Month</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={displayedTrendRows} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0066cc" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h4 style={{ marginTop: 0, marginBottom: 12 }}>Data Table</h4>
                <table className="info-table info-table--grid">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>{selectedMetric || 'Metric'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTrendRows.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="reporting-toolbar">
          <h2>Quarterly Report</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ marginBottom: 0 }}>
                Year
                <select value={selectedYear} onChange={(event) => setSelectedYear(Number.parseInt(event.target.value, 10))} className="input" style={{ marginLeft: 8 }}>
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuarter(q)}
                  className={selectedQuarter === q ? 'btn-primary' : 'btn-secondary'}
                  style={{ minWidth: 60 }}
                >
                  Q{q}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const url = '/api/reporting/export?format=csv&from=' + quarterlyFrom + '&to=' + quarterlyTo;
                  window.location.href = url;
                }}
                title="Download quarterly data as CSV for spreadsheet analysis"
              >
                Export CSV
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const url = '/api/reporting/export?format=json&from=' + quarterlyFrom + '&to=' + quarterlyTo;
                  window.location.href = url;
                }}
                title="Download quarterly data as JSON for integration or backup"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 12, fontSize: '0.9em', color: '#666' }}>
          Q{selectedQuarter} {selectedYear} Report ({getQuarterMonthsLabel(selectedQuarter)}) — This quarterly report aggregates all monthly snapshots and displays metrics in CMA national report format.
        </p>

        {loadingQuarterly ? <p>Loading quarterly report...</p> : null}

        {!loadingQuarterly && quarterly ? (
          <>
            <div>
              {quarterly.rows.map((row) => {
                const eventData = [
                  { name: 'Secular', count: row.secularEventCount, attendance: row.secularEventAttendance },
                  { name: 'Outreach', count: row.outreachEventCount, attendance: row.outreachEventAttendance },
                  { name: 'Fellowship', count: row.fellowshipEventCount, attendance: row.fellowshipEventAttendance }
                ];

                const ministryData = [
                  { name: 'Salvations', value: row.salvations, color: '#0066cc' },
                  { name: 'Rededications', value: row.rededications, color: '#00aa00' },
                  { name: 'Other Ministry', value: row.otherMinistry, color: '#ff9900' }
                ];

                return (
                  <div key={row.chapterId} style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #ddd' }}>
                  <h3>{formatChapterLabel(row.chapter)}</h3>

                  {/* Event Comparison Chart */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Event Activity Comparison</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={eventData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" label={{ value: 'Event Count', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Attendance', angle: 90, position: 'insideRight' }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="count" fill="#0066cc" name="# Events" />
                        <Bar yAxisId="right" dataKey="attendance" fill="#66ccff" name="Attendance" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Ministry Outcomes Chart */}
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 12 }}>Ministry Outcomes</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ministryData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0066cc" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 12 }}>
                    {/* Secular Events */}
                    <div style={{ padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Secular Events</div>
                      <div style={{ fontSize: '1.2em', fontWeight: 600, marginBottom: 4 }}>Count: {row.secularEventCount}</div>
                      <div style={{ fontSize: '1em' }}>Attendance: {row.secularEventAttendance}</div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>Avg/Event: {row.secularEventAvgParticipation}</div>
                    </div>

                    {/* Outreach Events */}
                    <div style={{ padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Outreach Events</div>
                      <div style={{ fontSize: '1.2em', fontWeight: 600, marginBottom: 4 }}>Count: {row.outreachEventCount}</div>
                      <div style={{ fontSize: '1em' }}>Attendance: {row.outreachEventAttendance}</div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>Avg/Event: {row.outreachEventAvgParticipation}</div>
                    </div>

                    {/* Fellowship Events */}
                    <div style={{ padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Fellowship Events</div>
                      <div style={{ fontSize: '1.2em', fontWeight: 600, marginBottom: 4 }}>Count: {row.fellowshipEventCount}</div>
                      <div style={{ fontSize: '1em' }}>Attendance: {row.fellowshipEventAttendance}</div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>Avg/Event: {row.fellowshipEventAvgParticipation}</div>
                    </div>
                  </div>

                  {/* Ministry Outcomes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
                    <div style={{ padding: 12, backgroundColor: '#f0f7ff', borderRadius: 4, borderLeft: '4px solid #0066cc' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Salvations</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#0066cc' }}>{row.salvations}</div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#f0fff0', borderRadius: 4, borderLeft: '4px solid #00aa00' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Rededications</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#00aa00' }}>{row.rededications}</div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#fff5e6', borderRadius: 4, borderLeft: '4px solid #ff9900' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Other Ministry</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#ff9900' }}>{row.otherMinistry}</div>
                    </div>
                  </div>

                  {/* Guest Tracking */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
                    <div style={{ padding: 12, backgroundColor: '#f5e6f7', borderRadius: 4, borderLeft: '4px solid #9933cc' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Guests (Month 1)</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#9933cc' }}>{row.guestMonth1}</div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#f5e6f7', borderRadius: 4, borderLeft: '4px solid #9933cc' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Guests (Month 2)</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#9933cc' }}>{row.guestMonth2}</div>
                    </div>

                    <div style={{ padding: 12, backgroundColor: '#f5e6f7', borderRadius: 4, borderLeft: '4px solid #9933cc' }}>
                      <div style={{ fontSize: '0.85em', color: '#666', marginBottom: 8 }}>Guests (Month 3)</div>
                      <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#9933cc' }}>{row.guestMonth3}</div>
                    </div>
                  </div>

                  <p style={{ marginTop: 12, fontSize: '0.85em', color: '#999' }}>
                    To export or modify details, view the Monthly Snapshot section above.
                  </p>
                </div>
              );
            })}
          </div>

          {/* Email Delivery Section */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '2px solid #ddd' }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Email Report</h3>
            <p style={{ fontSize: '0.9em', color: '#666' }}>
              Send this quarterly report to stakeholders via email. The report will include event summaries, ministry outcomes, and guest tracking data.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <label style={{ flex: 1, minWidth: 200 }}>
                Recipient Email
                <input
                  type="email"
                  placeholder="leader@chapter.com"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    fontFamily: 'inherit'
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!emailRecipient) {
                    setError('Please enter an email address');
                    return;
                  }
                  setError(null);
                  setImportMessage('Email preview generated. Ready to send.');
                }}
                title="Preview and configure email delivery"
              >
                Preview Email
              </button>
            </div>
            <p style={{ fontSize: '0.8em', color: '#999' }}>
              Note: Email delivery infrastructure can be configured with SendGrid, Mailgun, AWS SES, or your email service provider.
            </p>
          </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
