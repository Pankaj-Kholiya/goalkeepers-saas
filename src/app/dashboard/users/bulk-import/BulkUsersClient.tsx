'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  X,
  RotateCcw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  validateBulkUserRow,
  normalizeImportRole,
  BULK_USER_IMPORT_MAX_ROWS,
  type BulkUserRow,
  type BulkUserImportResult,
} from '@/lib/user-import'
import { ROLE_LABEL } from '@/lib/roles'
import { bulkCreateUsersAction } from '../actions'

const KNOWN_KEYS: (keyof BulkUserRow)[] = ['name', 'email', 'role', 'password']

const SAMPLE_CSV = [
  'name,email,role,password',
  'Asha Verma,asha@school.edu,student,',
  'Ravi Kumar,ravi@school.edu,teacher,',
  'Meera Singh,meera@school.edu,admin,ChangeMe123',
].join('\n')
const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`

type Stage = 'EMPTY' | 'REVIEW' | 'SUBMITTING' | 'DONE'

interface ParsedRow extends BulkUserRow {
  rowNumber: number
  error: string | null
}

function rowFromRaw(raw: Record<string, string>): BulkUserRow {
  const row: BulkUserRow = {}
  for (const key of KNOWN_KEYS) {
    const value = raw[key]
    if (typeof value === 'string') row[key] = value.trim()
  }
  return row
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export function BulkUsersClient() {
  const [stage, setStage] = useState<Stage>('EMPTY')
  const [filename, setFilename] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkUserImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    setParseError(null)
    setRows([])
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file. Save your spreadsheet as CSV first.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is larger than 5 MB.')
      return
    }
    setFilename(file.name)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: (results) => {
        if (results.errors.length > 0) {
          const first = results.errors[0]
          setParseError(
            `CSV parse error on row ${(first.row ?? 0) + 2}: ${first.message}`,
          )
          return
        }
        const data = results.data
        if (data.length === 0) {
          setParseError('CSV has no data rows.')
          return
        }
        if (data.length > BULK_USER_IMPORT_MAX_ROWS) {
          setParseError(
            `CSV has ${data.length} rows. Maximum is ${BULK_USER_IMPORT_MAX_ROWS} per import - split into chunks.`,
          )
          return
        }
        const headers = results.meta.fields ?? []
        const missing = ['name', 'email'].filter((h) => !headers.includes(h))
        if (missing.length > 0) {
          setParseError(
            `CSV is missing required column(s): ${missing.join(', ')}. Download the sample to see the format.`,
          )
          return
        }
        const parsed: ParsedRow[] = data.map((raw, i) => {
          const row = rowFromRaw(raw)
          const verdict = validateBulkUserRow(row)
          return { ...row, rowNumber: i + 2, error: verdict.ok ? null : verdict.error }
        })
        setRows(parsed)
        setStage('REVIEW')
      },
      error: (err) => setParseError(`Could not read file: ${err.message}`),
    })
  }, [])

  const validCount = useMemo(
    () => rows.filter((r) => r.error === null).length,
    [rows],
  )
  const invalidCount = rows.length - validCount

  async function handleSubmit() {
    if (rows.length === 0) return
    setStage('SUBMITTING')
    const payload: BulkUserRow[] = rows.map(({ rowNumber, error, ...rest }) => {
      void rowNumber
      void error
      return rest
    })
    try {
      const res = await bulkCreateUsersAction(payload)
      setResult(res)
      setStage('DONE')
    } catch {
      setParseError('The server rejected the import. Please try again.')
      setStage('REVIEW')
    }
  }

  function reset() {
    setStage('EMPTY')
    setFilename(null)
    setRows([])
    setParseError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {stage === 'EMPTY' && (
        <div className="space-y-4">
          <div
            onDragEnter={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setDragActive(false)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-14 ${
              dragActive
                ? 'border-brand bg-accent-softer/40'
                : 'border-line bg-surface hover:border-brand/40 hover:bg-accent-softer/10'
            }`}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent-softer text-brand-deep">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-ink">
              Drop your CSV here, or click to browse
            </p>
            <p className="mt-1 text-sm text-ink-subtle">
              Columns: name, email, role, password. Up to{' '}
              {BULK_USER_IMPORT_MAX_ROWS} users. Max 5 MB.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose CSV file
              </Button>
              <Button asChild variant="outline">
                <a href={SAMPLE_HREF} download="sample-users.csv">
                  <Download className="h-4 w-4" /> Sample CSV
                </a>
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-faint">
            Role accepts <code>admin</code>, <code>teacher</code> or{' '}
            <code>student</code> (blank = student). Leave password blank to
            auto-generate one per user - you&apos;ll get a downloadable list of
            credentials to share.
          </p>
          {parseError && <ErrorBox>{parseError}</ErrorBox>}
        </div>
      )}

      {stage === 'REVIEW' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-brand-deep" />
              <span className="truncate text-sm font-medium text-ink">
                {filename ?? 'users.csv'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-1 font-semibold text-[#166534]">
                <CheckCircle2 className="h-3 w-3" /> {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-2 py-1 font-semibold text-[#b91c1c]">
                  <AlertCircle className="h-3 w-3" /> {invalidCount} need fixing
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4" /> Different file
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line-soft bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-line-soft bg-surface-muted">
                <tr>
                  <th className="w-12 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Name</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Email</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Role</th>
                  <th className="w-8 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const bad = row.error !== null
                  const role = normalizeImportRole(row.role)
                  return (
                    <tr key={row.rowNumber} className={`border-b border-line-soft last:border-0 ${bad ? 'bg-[#fef2f2]' : ''}`}>
                      <td className="px-3 py-2 align-top font-mono text-xs text-ink-faint">{row.rowNumber}</td>
                      <td className="px-3 py-2 align-top text-ink">{row.name || '-'}</td>
                      <td className="px-3 py-2 align-top text-ink-subtle">{row.email || '-'}</td>
                      <td className="px-3 py-2 align-top text-ink-subtle">{role ? ROLE_LABEL[role] : '-'}</td>
                      <td className="px-3 py-2 align-top text-right">
                        {bad ? (
                          <span title={row.error ?? ''} className="inline-flex text-[#b91c1c]">
                            <AlertCircle className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="inline-flex text-[#10b981]">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {invalidCount > 0 && (
            <div className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-xs leading-relaxed text-[#9a3412]">
              <strong className="font-semibold">{invalidCount} row{invalidCount === 1 ? '' : 's'} will be skipped.</strong>{' '}
              Hover the red icon to see why, or click Import and the server skips them.
            </div>
          )}
          {parseError && <ErrorBox>{parseError}</ErrorBox>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={reset}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={validCount === 0}>
              Import {validCount} user{validCount === 1 ? '' : 's'}
              {invalidCount > 0 && ` (skip ${invalidCount})`}
            </Button>
          </div>
        </div>
      )}

      {stage === 'SUBMITTING' && (
        <div className="rounded-2xl border border-line-soft bg-surface p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-4 text-base font-semibold text-ink">Creating accounts…</p>
          <p className="mt-1 text-sm text-ink-subtle">
            Hashing passwords takes a moment. Do not close this tab.
          </p>
        </div>
      )}

      {stage === 'DONE' && result && (
        <DoneView result={result} onReset={reset} />
      )}
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function DoneView({
  result,
  onReset,
}: {
  result: BulkUserImportResult
  onReset: () => void
}) {
  if (!result.ok) {
    return (
      <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6">
        <h3 className="font-heading text-base font-bold text-[#7f1d1d]">
          Import was rejected
        </h3>
        <p className="mt-1 text-sm text-[#991b1b]">{result.error}</p>
        <Button variant="outline" onClick={onReset} className="mt-4">
          <RotateCcw className="h-4 w-4" /> Try a different file
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#16a34a]" />
          <div>
            <h3 className="font-heading text-base font-bold text-[#166534]">
              {result.created.length} account
              {result.created.length === 1 ? '' : 's'} created
            </h3>
            <p className="mt-1 text-sm text-[#166534]/80">
              Download the credentials below and share each person their
              temporary password. They can change it after signing in.
            </p>
          </div>
        </div>
      </div>

      {result.created.length > 0 && (
        <div className="rounded-2xl border border-line-soft bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <h3 className="font-heading text-sm font-bold text-ink">
              Credentials to share
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv('user-credentials.csv', [
                  ['name', 'email', 'role', 'temporary_password'],
                  ...result.created.map((c) => [
                    c.name,
                    c.email,
                    ROLE_LABEL[c.role],
                    c.password,
                  ]),
                ])
              }
            >
              <Download className="h-4 w-4" /> Download CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line-soft bg-surface-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Email</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Role</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Temp password</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((c) => (
                  <tr key={c.email} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2 text-ink">{c.email}</td>
                    <td className="px-4 py-2 text-ink-subtle">{ROLE_LABEL[c.role]}</td>
                    <td className="px-4 py-2 font-mono text-xs text-ink">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.failed.length > 0 && (
        <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-5">
          <h3 className="font-heading text-base font-bold text-[#9a3412]">
            {result.failed.length} row{result.failed.length === 1 ? '' : 's'} skipped
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#fed7aa] bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-[#fed7aa] bg-[#fff7ed]">
                <tr>
                  <th className="w-16 px-3 py-2 text-left font-semibold text-[#9a3412]">Row</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#9a3412]">Email</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#9a3412]">Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((f) => (
                  <tr key={`${f.rowNumber}-${f.email}`} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="px-3 py-2 align-top font-mono text-xs text-ink-faint">{f.rowNumber}</td>
                    <td className="px-3 py-2 align-top text-ink-subtle">{f.email || '-'}</td>
                    <td className="px-3 py-2 align-top text-[#9a3412]">{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Import another file
        </Button>
        <Button asChild>
          <a href="/dashboard/users">Back to users</a>
        </Button>
      </div>
    </div>
  )
}
