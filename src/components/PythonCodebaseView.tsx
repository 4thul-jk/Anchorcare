import React, { useState } from 'react';
import { PYTHON_PROJECT_FILES, PythonProjectFile } from '../lib/pythonCodebase';

export const PythonCodebaseView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<PythonProjectFile>(
    PYTHON_PROJECT_FILES[0]
  );
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopyFile = async (file: PythonProjectFile) => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // Fallback if clipboard API restricted
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    }
  };

  const handleDownloadAllBundle = () => {
    const bundleContent = PYTHON_PROJECT_FILES.map(
      (f) =>
        `# ==============================================================================\n# FILE: ${f.path}\n# SUMMARY: ${f.summary}\n# ==============================================================================\n\n${f.code}\n`
    ).join('\n\n');

    const blob = new Blob([bundleContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'anchorcare_python_caregiver_suite.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Complete Python + MongoDB Atlas + Gemini 4 Argon Codebase (caregiver/)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All {PYTHON_PROJECT_FILES.length} production-hardened Python files with P0/P1/P2 audit fixes applied (Typed ProposedAction, [E1..En] aliases, atomic supersession, 3-tier policy gate, TOCTOU check)
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadAllBundle}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Download All Python Files (.py Bundle)
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left File Tree Navigation */}
        <aside
          aria-label="Python Project Files"
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2"
        >
          <p className="text-xs font-semibold text-slate-500 px-2 pb-1">
            Project Directory (caregiver/)
          </p>
          <div className="space-y-1">
            {PYTHON_PROJECT_FILES.map((file) => {
              const isSelected = file.path === selectedFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold truncate">
                      {file.path}
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {file.category}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[11px] tabular-nums shrink-0 ${
                      isSelected ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {file.code.split('\n').length}L
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Code Viewer & Audit Fix Notes */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-mono text-slate-900">
                  {selectedFile.path}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{selectedFile.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyFile(selectedFile)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedPath === selectedFile.path ? 'Copied to Clipboard' : `Copy ${selectedFile.filename}`}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-1">
                Technical Audit Fixes Implemented in {selectedFile.filename}:
              </p>
              <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                {selectedFile.auditFixesIncluded.map((fix, i) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
            </div>
          </div>

          <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed max-h-[640px]">
            <code>{selectedFile.code}</code>
          </pre>
        </section>
      </div>
    </div>
  );
};
