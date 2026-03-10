import { useState, useRef } from 'react'
import api from '../../api/client'

export default function CsvImportModal({ onClose, onImported, endpoint, columns, exampleRow }) {
  const [step, setStep] = useState('upload')   // upload | preview | done
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const fileRef = useRef()

  const headers = columns.map(c => c.key)
  const exampleCsv = [headers.join(','), Object.values(exampleRow).join(',')].join('\n')

  // ── Download template ───────────────────────────────────────────────────────
  function downloadTemplate() {
    const blob = new Blob([exampleCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Parse ───────────────────────────────────────────────────────────────────
  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return { rows: [], errs: ['CSV must have a header row and at least one data row.'] }

    const fileHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const errs = []
    const rows = []

    lines.slice(1).forEach((line, i) => {
      const values = line.split(',').map(v => v.trim())
      const obj = {}
      fileHeaders.forEach((h, j) => { obj[h] = values[j] ?? '' })

      const row = {}
      columns.forEach(col => {
        const val = obj[col.key] ?? obj[col.label?.toLowerCase().replace(/\s+/g, '_')] ?? ''
        row[col.key] = val !== '' ? val : (col.default ?? '')
      })

      const missing = columns.filter(c => c.required && !row[c.key])
      if (missing.length) {
        errs.push(`Row ${i + 2}: missing ${missing.map(c => c.label).join(', ')}`)
        return
      }

      columns.filter(c => c.type === 'number').forEach(c => {
        row[c.key] = row[c.key] !== '' ? parseFloat(row[c.key]) : (c.default ?? null)
      })

      rows.push(row)
    })

    return { rows, errs }
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRawText(ev.target.result)
    reader.readAsText(file)
  }

  function handlePreview() {
    const { rows, errs } = parseCsv(rawText)
    setParsed(rows)
    setErrors(errs)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    setImportError('')
    try {
      const res = await api.post(endpoint, { rows: parsed })
      onImported(res.data)
      setStep('done')
    } catch (err) {
      setImportError(err.response?.data?.error || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-3xl sm:mx-4 sm:rounded-2xl flex flex-col bg-white" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-800 text-base">Import from CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none transition">✕</button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">

          {/* ── Step: upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">

              {/* Column reference */}
              <div>
                <p className="text-sm text-slate-600 mb-3">
                  Upload a <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">.csv</code> file or paste CSV text below.
                  The first row must be a header with these columns:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {columns.map(c => (
                    <span
                      key={c.key}
                      className={`px-2 py-0.5 rounded text-xs font-mono ${
                        c.required
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.key}{c.required ? '*' : ''}
                    </span>
                  ))}
                </div>

                {/* Template download + example toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                  >
                    ⬇ Download CSV Template
                  </button>
                  <details className="text-xs text-slate-500 flex-1">
                    <summary className="cursor-pointer hover:text-slate-700 select-none">Show example CSV</summary>
                    <pre className="mt-2 bg-slate-50 border border-slate-200 p-3 rounded-lg overflow-x-auto text-slate-600 font-mono">{exampleCsv}</pre>
                  </details>
                </div>
              </div>

              {/* File picker */}
              <div>
                <input type="file" accept=".csv,text/csv" ref={fileRef} onChange={handleFile} className="hidden" />
                <button
                  onClick={() => fileRef.current.click()}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
                >
                  Choose file
                </button>
                {rawText && <span className="ml-3 text-xs text-green-600">File loaded ({rawText.split('\n').length} lines)</span>}
              </div>

              {/* Paste area */}
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Or paste CSV here:</p>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={exampleCsv}
                  rows={6}
                  className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none text-slate-700 placeholder-slate-300"
                  style={{ background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.1)' }}
                />
              </div>
            </div>
          )}

          {/* ── Step: preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  {errors.map((e, i) => <p key={i} className="text-red-600 text-xs">{e}</p>)}
                </div>
              )}

              {parsed.length > 0 ? (
                <>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{parsed.length} row{parsed.length !== 1 ? 's' : ''}</span> ready to import
                    {errors.length > 0 ? ` (${errors.length} skipped due to errors)` : ''}.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {columns.map(c => (
                            <th key={c.key} className="text-left px-3 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                            {columns.map(c => (
                              <td key={c.key} className="px-3 py-2 text-slate-700 font-mono">{String(row[c.key] ?? '—')}</td>
                            ))}
                          </tr>
                        ))}
                        {parsed.length > 20 && (
                          <tr className="border-t border-slate-100">
                            <td colSpan={columns.length} className="px-3 py-2 text-slate-400 text-center">
                              …and {parsed.length - 20} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {importError && <p className="text-red-600 text-sm">{importError}</p>}
                </>
              ) : (
                <p className="text-slate-500 text-sm">No valid rows found. Check your CSV format.</p>
              )}
            </div>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
              <p className="text-lg font-semibold text-slate-800">Import successful!</p>
              <p className="text-slate-500 text-sm mt-1">{parsed.length} records imported.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200"
          >
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-3">
            {step === 'preview' && (
              <button onClick={() => setStep('upload')} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200">
                ← Back
              </button>
            )}
            {step === 'upload' && (
              <button
                onClick={handlePreview}
                disabled={!rawText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              >
                Preview →
              </button>
            )}
            {step === 'preview' && parsed.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              >
                {importing ? 'Importing...' : `Import ${parsed.length} rows`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
