import { useState } from 'react';
import { useSimStore } from '../store/useSimStore';
import {
  parseTable,
  autoMap,
  buildDataset,
  MAPPING_FIELDS,
  type MappingKey,
  type ParsedTable,
  SAMPLE_CSV,
} from '../data/adapter';
import { OFFICIAL_DATASET } from '../data/officialDataset';
import { SYNTHETIC_DATASET } from '../data/synthetic';

export const LoadDataModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const loadDataset = useSimStore((s) => s.loadDataset);
  const toast = useSimStore((s) => s.toast);

  const [filename, setFilename] = useState<string>('');
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<MappingKey, string>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  if (!open) return null;

  const handleFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const parsed = parseTable(text, file.name);
      setTable(parsed);
      if (parsed.error) {
        setErrors([parsed.error]);
        return;
      }
      setErrors([]);
      const mapped = autoMap(parsed.columns);
      setMapping(mapped);
    };
    reader.readAsText(file);
  };

  const handleBuildAndLoad = () => {
    if (!table || !table.rows.length) return;
    const res = buildDataset(table.rows, mapping, filename || 'Custom uploaded fleet');
    if (res.errors.length) {
      setErrors(res.errors);
      setWarnings(res.warnings);
      return;
    }
    setWarnings(res.warnings);
    if (res.dataset) {
      loadDataset(res.dataset);
      toast(`Successfully imported ${res.dataset.flights.length} flights!`, 'good');
      onClose();
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domino_sky_sample_flights.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-ink-900 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-base">
              📂
            </span>
            <div>
              <h2 className="text-base font-bold text-white">LOAD FLIGHT DATASET</h2>
              <p className="text-[11px] text-slate-400">
                CSV / JSON importer with schema column mapper & official competition presets
              </p>
            </div>
          </div>
          <button className="btn !px-2.5 !py-1 text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-thin space-y-6">
          {/* Quick Presets Section */}
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
            <div className="font-bold text-white text-xs uppercase tracking-wider mb-2">
              Ready-to-Use Competition Datasets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className="btn btn-primary !p-3 text-left flex flex-col gap-1 items-start"
                onClick={() => {
                  loadDataset(OFFICIAL_DATASET);
                  toast('Loaded Official Competition Dataset', 'good');
                  onClose();
                }}
              >
                <div className="font-bold text-cyan-200">Official Competition Dataset</div>
                <div className="text-[10px] text-slate-300">
                  16 airports · 16 tails · 68 flights · 21 connections · 16 crews · 2 spares
                </div>
              </button>

              <button
                className="btn !p-3 text-left flex flex-col gap-1 items-start"
                onClick={() => {
                  loadDataset(SYNTHETIC_DATASET);
                  toast('Loaded Dense Fleet Dataset', 'good');
                  onClose();
                }}
              >
                <div className="font-bold text-white">Dense Synthetic Fleet</div>
                <div className="text-[10px] text-slate-400">
                  16 airports · 25 aircraft · 148 flights · high-volume stress scenario
                </div>
              </button>
            </div>
          </div>

          {/* Drag & Drop File Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label">Drag & Drop Upload (CSV or JSON)</span>
              <button
                type="button"
                className="text-[11px] text-cyan-400 hover:underline"
                onClick={handleDownloadSample}
              >
                📥 Download Sample CSV Template
              </button>
            </div>

            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/[0.02] p-6 hover:border-cyan-400/50 hover:bg-white/[0.04] transition-all cursor-pointer">
              <input
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <span className="text-2xl mb-1">📄</span>
              <span className="font-semibold text-white">
                {filename ? filename : 'Drop your CSV or JSON file here, or click to browse'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Supports flight rosters in any column format
              </span>
            </label>
          </div>

          {/* Errors / Warnings */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-rose-200 space-y-1">
              <div className="font-bold">Errors encountered:</div>
              {errors.map((err, i) => (
                <div key={i} className="text-[11px]">• {err}</div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-amber-200 space-y-1">
              <div className="font-bold">Notices:</div>
              {warnings.map((warn, i) => (
                <div key={i} className="text-[11px]">• {warn}</div>
              ))}
            </div>
          )}

          {/* Column Mapping Section if file is parsed */}
          {table && table.columns.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="label">Map File Columns to Domino Sky Model</span>
                <span className="text-[10px] text-slate-400">
                  Found {table.rows.length} rows, {table.columns.length} columns
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MAPPING_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                      </span>
                    </div>
                    <select
                      className="w-full rounded border border-white/10 bg-ink-950 p-1.5 text-white"
                      value={mapping[field.key] || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field.key]: e.target.value })
                      }
                    >
                      <option value="">-- Choose column --</option>
                      {table.columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Data Preview Table */}
              <div className="space-y-1.5">
                <span className="label">Sample Raw Rows Preview</span>
                <div className="overflow-x-auto rounded-lg border border-white/10 scroll-thin max-h-40">
                  <table className="w-full text-left text-[10px] font-mono">
                    <thead className="bg-ink-950 text-slate-400 border-b border-white/10">
                      <tr>
                        {table.columns.slice(0, 7).map((col) => (
                          <th key={col} className="p-2 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {table.rows.slice(0, 4).map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          {table.columns.slice(0, 7).map((col) => (
                            <td key={col} className="p-2 text-slate-300">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-ink-950/80 px-6 py-3">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          {table && (
            <button className="btn btn-primary font-bold" onClick={handleBuildAndLoad}>
              Build & Load Flight Network →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
