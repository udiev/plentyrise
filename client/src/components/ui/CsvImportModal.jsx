import { useState, useRef } from 'react'
import api from '../../api/client'

/**
 * Generic CSV import modal.
 *
 * Props:
 *   onClose()              – close the modal
 *   onImported(rows)       – called with newly created rows after success
 *   endpoint               – e.g. '/investments/import'
 *   columns                – [{ key, label, required?, default?, type? }]
 *   exampleRow             – object with sample values for the template hint
 */
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

  // ── Parse ──────────────────────────────────────────────────────────────────
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

      // Map to expected columns, apply defaults
      const row = {}
      columns.forEach(col => {
        const val = obj[col.key] ?? obj[col.label?.toLowerCase().replace(/\s+/g, '_')] ?? ''
        row[col.key] = val !== '' ? val : (col.default ?? '')
      })

      // Validate required
      const missing = columns.filter(c => c.required && !row[c.key])
      if (missing.length) {
        errs.push(`Row ${i + 2}: missing ${missing.map(c => c.label).join(', ')}`)
        return
      }

      // Cast numbers
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

  // ── Import ─────────────────────────────────────────────────────────────────
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

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="font-semibold text-lg">Import from CSV</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">

          {/* ── Step: upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-slate-400 mb-3">
                  Upload a <code className="bg-slate-800 px-1 rounded">.csv</code> file or paste CSV text below.
                  The first row must be a header row with these column names:
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {columns.map(c => (
                    <span key={c.key} className={`px-2 py-0.5 rounded text-xs font-mono ${c.required ? 'bg-blue-900/60 text-blue-300 border border-blue-700' : 'bg-slate-800 text-slate-400'}`}>
                      {c.key}{c.required ? '*' : ''}
                    </span>
                  ))}
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-300">Show example CSV</summary>
                  <pre className="mt-2 bg-slate-800 p-3 rounded-lg overflow-x-auto text-slate-300">{exampleCsv}</pre>
                </details>
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileRef}
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current.click()}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm transition mb-3"
                >
                  Choose file
                </button>
                {rawText && <p className="text-xs text-green-400 mb-2">File loaded ({rawText.split('\n').length} lines)</p>}
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Or paste CSV here:</p>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={exampleCsv}
                  rows={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step: preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {errors.length > 0 && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 space-y-1">
                  {errors.map((e, i) => <p key={i} className="text-red-400 text-xs">{e}</p>)}
                </div>
              )}

              {parsed.length > 0 ? (
                <>
                  <p className="text-sm text-slate-400">{parsed.length} row{parsed.length !== 1 ? 's' : ''} ready to import{errors.length > 0 ? ` (${errors.length} skipped due to errors)` : ''}.</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/60">
                        <tr>
                          {columns.map(c => <th key={c.key} className="text-left px-3 py-2 text-slate-400 font-medium">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                            {columns.map(c => <td key={c.key} className="px-3 py-2 text-slate-300 font-mono">{String(row[c.key] ?? '—')}</td>)}
                          </tr>
                        ))}
                        {parsed.length > 20 && (
                          <tr className="border-t border-slate-800">
                            <td colSpan={columns.length} className="px-3 py-2 text-slate-500 text-center">
                              ...and {parsed.length - 20} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {importError && <p className="text-red-400 text-sm">{importError}</p>}
                </>
              ) : (
                <p className="text-slate-500 text-sm">No valid rows found. Check your CSV format.</p>
              )}
            </div>
          )}

          {/* ── Step: done ── */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-lg font-semibold text-green-400">Import successful!</p>
              <p className="text-slate-500 text-sm mt-1">{parsed.length} records imported.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-800">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-3">
            {step === 'preview' && parsed.length === 0 && (
              <button onClick={() => setStep('upload')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Back</button>
            )}
            {step === 'upload' && (
              <button
                onClick={handlePreview}
                disabled={!rawText.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Preview →
              </button>
            )}
            {step === 'preview' && parsed.length > 0 && (
              <>
                <button onClick={() => setStep('upload')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Back</button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Import ${parsed.length} rows`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
