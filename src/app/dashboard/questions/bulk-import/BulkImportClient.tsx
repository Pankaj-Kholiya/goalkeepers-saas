/**
 * Client side of the question bulk-import.
 *
 * Flow (state machine):
 *   1. EMPTY      -> sample CSV download + format reference + drag-drop / picker
 *   2. REVIEW     -> rows parsed, preview table with per-row valid/invalid
 *   3. SUBMITTING -> server action in flight
 *   4. DONE       -> { created, failed[] } summary + Reset
 *
 * Class is REQUIRED. The author picks an import-wide class (applied to every
 * row); an optional per-row `class` column overrides it. Client validation
 * reuses the SAME `validateBulkQuestionRow` the server action runs, so the
 * preview's verdict matches the import exactly — and re-runs when the chosen
 * class changes (no re-parse needed).
 *
 * CSV columns: type, text, option_a..option_f, correct_answer, marks,
 * difficulty, subject, topic, chapter, class (optional), model_answer,
 * image_url, subparts_json.
 */

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
} from '@/components/icons'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLASS_GRADES } from '@/lib/classes'
import { useToast } from '@/components/toast'
import {
  validateBulkQuestionRow,
  BULK_IMPORT_MAX_ROWS,
  type BulkQuestionRow,
  type BulkQuestionImportResult,
} from '@/lib/questions'
import { bulkCreateQuestionsAction } from '../actions'

/** Every CSV column the importer reads, in display order. */
const KNOWN_KEYS: (keyof BulkQuestionRow)[] = [
  'type',
  'text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'option_f',
  'correct_answer',
  'marks',
  'difficulty',
  'subject',
  'topic',
  'chapter',
  'class',
  'model_answer',
  'image_url',
  'subparts_json',
]

/** A small, valid sample covering each question type. Offered as a
 *  download so authors can see the exact shape of every column. */
const SAMPLE_CSV = [
  'type,text,option_a,option_b,option_c,option_d,correct_answer,marks,difficulty,subject,topic,chapter,class,model_answer,image_url,subparts_json',
  'MCQ,"If x + 5 = 12, what is x?",5,6,7,8,c,1,EASY,Mathematics,Algebra,Linear Equations,Class 6,"Subtract 5 from both sides.",,',
  'MSQ,"Which of these are prime numbers?",2,3,4,9,a b,2,MEDIUM,Mathematics,Numbers,Primes,Class 6,"2 and 3 are prime.",,',
  'SHORT,"Name the powerhouse of the cell.",,,,,Mitochondria,1,EASY,Science,Biology,The Cell,Class 8,,,',
  'LONG,"Explain the water cycle in your own words.",,,,,,5,MEDIUM,Science,Geography,Water Cycle,Class 8,"Look for evaporation, condensation, precipitation.",,',
  'ASSERTION_REASONING,"Assertion: Water boils at 100C. Reason: At sea level pressure is 1 atm.",,,,,1,1,MEDIUM,Science,Physics,Heat,Class 9,,,',
  'CASE_BASED,"Read the passage about photosynthesis and answer.",,,,,,3,HARD,Science,Biology,Photosynthesis,Class 10,,,"[{""label"":""A"",""text"":""Define photosynthesis."",""marks"":1},{""label"":""B"",""text"":""Name the byproduct."",""marks"":2}]"',
].join('\n')

const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`

type Stage = 'EMPTY' | 'REVIEW' | 'SUBMITTING' | 'DONE'

interface ParsedRow extends BulkQuestionRow {
  rowNumber: number
  /** Empty when the row passes validation; otherwise the first error. */
  error: string | null
}

/** Pick the known CSV columns out of one parsed row, trimming each. */
function rowFromRaw(raw: Record<string, string>): BulkQuestionRow {
  const row: BulkQuestionRow = {}
  for (const key of KNOWN_KEYS) {
    const value = raw[key]
    if (typeof value === 'string') row[key] = value.trim()
  }
  return row
}

/** One-line answer preview for the review table. */
function answerSummary(row: BulkQuestionRow): string {
  const type = (row.type ?? '').trim().toUpperCase()
  if (type === 'MCQ' || type === 'MSQ' || type === 'ASSERTION_REASONING') {
    return (row.correct_answer ?? '').trim().toLowerCase() || '-'
  }
  if (type === 'SHORT') {
    return (row.correct_answer ?? '').trim() || '(model answer only)'
  }
  if (type === 'LONG') {
    return '(model answer only)'
  }
  if (type === 'CASE_BASED') {
    const sp = (row.subparts_json ?? '').trim()
    if (!sp) return '(no sub-parts)'
    try {
      const parsed = JSON.parse(sp)
      if (Array.isArray(parsed)) {
        return `${parsed.length} sub-part${parsed.length === 1 ? '' : 's'}`
      }
    } catch {
      // fall through
    }
    return '(invalid JSON)'
  }
  return '-'
}

/** A parsed CSV row before validation — the raw columns + its display number. */
type RawRow = BulkQuestionRow & { rowNumber: number }

export function BulkImportClient() {
  const [stage, setStage] = useState<Stage>('EMPTY')
  const [filename, setFilename] = useState<string | null>(null)
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  // Import-wide class, applied to every row (a per-row `class` column overrides
  // it). Required: a row with neither fails validation.
  const [importClass, setImportClass] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkQuestionImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const handleFile = useCallback((file: File) => {
    setParseError(null)
    setRawRows([])

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file (not .xlsx). Save as CSV first.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File is larger than 5 MB. Are you sure that is a CSV?')
      return
    }

    setFilename(file.name)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) =>
        h.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'),
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
          setParseError('CSV has no data rows. Add at least one question.')
          return
        }
        if (data.length > BULK_IMPORT_MAX_ROWS) {
          setParseError(
            `CSV has ${data.length} rows. Maximum is ${BULK_IMPORT_MAX_ROWS} per import - split into chunks.`,
          )
          return
        }

        const headers = results.meta.fields ?? []
        const missingRequired = ['type', 'text', 'subject'].filter(
          (h) => !headers.includes(h),
        )
        if (missingRequired.length > 0) {
          setParseError(
            `CSV is missing required column(s): ${missingRequired.join(', ')}. Download the sample CSV to see the expected format.`,
          )
          return
        }

        const parsed: RawRow[] = data.map((raw, i) => ({
          ...rowFromRaw(raw),
          rowNumber: i + 2,
        }))

        setRawRows(parsed)
        setStage('REVIEW')
      },
      error: (err) => {
        setParseError(`Could not read file: ${err.message}`)
      },
    })
  }, [])

  // Validate (and re-validate) the preview against the chosen import-wide
  // class, so changing the class updates the verdicts without re-parsing.
  const rows = useMemo<ParsedRow[]>(
    () =>
      rawRows.map((r) => {
        const verdict = validateBulkQuestionRow(r, {
          classGrade: importClass.trim(),
        })
        return { ...r, error: verdict.ok ? null : verdict.error }
      }),
    [rawRows, importClass],
  )

  const validCount = useMemo(
    () => rows.filter((r) => r.error === null).length,
    [rows],
  )
  const invalidCount = rows.length - validCount

  async function handleSubmit() {
    if (rows.length === 0) return
    setStage('SUBMITTING')
    const payload: BulkQuestionRow[] = rows.map((row) => {
      // Strip the client-only preview fields before sending to the
      // server action; keep just the raw CSV columns.
      const { rowNumber, error, ...rest } = row
      void rowNumber
      void error
      return rest
    })
    try {
      const res = await bulkCreateQuestionsAction(payload, {
        classGrade: importClass.trim(),
      })
      setResult(res)
      setStage('DONE')
      if (res.ok) {
        toast.success(
          `${res.created} question${res.created === 1 ? '' : 's'} imported` +
            (res.failed.length
              ? `, ${res.failed.length} skipped`
              : '') +
            '.',
        )
      } else {
        toast.error(res.error ?? 'Import failed.')
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the import. Please try again.'
      setParseError(message)
      toast.error(message)
      setStage('REVIEW')
    }
  }

  function reset() {
    setStage('EMPTY')
    setFilename(null)
    setRawRows([])
    setParseError(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {(stage === 'EMPTY' || stage === 'REVIEW') && (
        <div className="rounded-2xl border border-[#eef0f2] bg-[#fafbfd] p-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-class">
                Import all into class{' '}
                <span className="text-[#dc2626]">*</span>
              </Label>
              <Select
                value={importClass || undefined}
                onValueChange={setImportClass}
              >
                <SelectTrigger id="import-class" className="w-56">
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_GRADES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="max-w-sm flex-1 text-xs text-[#6c757d]">
              Required. Applied to every row in this import. A row that has its
              own <code className="font-mono">class</code> column overrides it.
            </p>
          </div>
        </div>
      )}

      {stage === 'EMPTY' && (
        <EmptyView
          dragActive={dragActive}
          setDragActive={setDragActive}
          handleFile={handleFile}
          fileInputRef={fileInputRef}
          parseError={parseError}
        />
      )}

      {stage === 'REVIEW' && (
        <ReviewView
          filename={filename}
          rows={rows}
          validCount={validCount}
          invalidCount={invalidCount}
          onSubmit={handleSubmit}
          onReset={reset}
          parseError={parseError}
        />
      )}

      {stage === 'SUBMITTING' && <SubmittingView count={rows.length} />}

      {stage === 'DONE' && result && (
        <DoneView result={result} onReset={reset} />
      )}
    </div>
  )
}

function SampleDownloadButton({
  variant = 'default',
}: {
  variant?: 'default' | 'outline'
}) {
  return (
    <Button asChild size="sm" variant={variant}>
      <a href={SAMPLE_HREF} download="sample-questions.csv">
        <Download className="h-4 w-4" /> Sample CSV
      </a>
    </Button>
  )
}

function EmptyView({
  dragActive,
  setDragActive,
  handleFile,
  fileInputRef,
  parseError,
}: {
  dragActive: boolean
  setDragActive: (v: boolean) => void
  handleFile: (file: File) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  parseError: string | null
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <div className="min-w-0 space-y-4">
        <div
          onDragEnter={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Ignore leave events fired when moving onto a child — only clear
            // the highlight when the pointer actually exits the drop zone.
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setDragActive(false)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
          }}
          className={`relative rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-14 ${
            dragActive
              ? 'border-[#4BA547] bg-[#DCFCE7]/30'
              : 'border-[#e6e8ec] bg-white hover:border-[#4BA547]/40 hover:bg-[#DCFCE7]/10'
          }`}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#4BA547]/15 to-[#3f8c3c]/15 text-[#3f8c3c]">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-[#1c2955]">
            Drop your CSV here, or click to browse
          </p>
          <p className="mt-1 text-sm text-[#6c757d]">
            Up to {BULK_IMPORT_MAX_ROWS} questions per file. Maximum size 5 MB.
          </p>
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5"
          >
            <Upload className="h-4 w-4" /> Choose CSV file
          </Button>
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

        {parseError && (
          <div className="flex items-start gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <ExpectedFormatCard />
      </aside>
    </div>
  )
}

function ReviewView({
  filename,
  rows,
  validCount,
  invalidCount,
  onSubmit,
  onReset,
  parseError,
}: {
  filename: string | null
  rows: ParsedRow[]
  validCount: number
  invalidCount: number
  onSubmit: () => void
  onReset: () => void
  parseError: string | null
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eef0f2] bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-[#3f8c3c]" />
          <span className="truncate text-sm font-medium text-[#1c2955]">
            {filename ?? 'questions.csv'}
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
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-4 w-4" /> Different file
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#eef0f2] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[#eef0f2] bg-[#f8f9fa]">
            <tr>
              <th className="w-12 px-3 py-2.5 text-left font-semibold text-[#6c757d]">
                #
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-[#6c757d]">
                Subject
              </th>
              <th className="w-16 px-3 py-2.5 text-left font-semibold text-[#6c757d]">
                Type
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-[#6c757d]">
                Question
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-[#6c757d]">
                Answer
              </th>
              <th className="w-8 px-3 py-2.5 text-left font-semibold text-[#6c757d]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const bad = row.error !== null
              return (
                <tr
                  key={row.rowNumber}
                  className={`border-b border-[#f1f5f9] ${bad ? 'bg-[#fef2f2]' : ''}`}
                >
                  <td className="px-3 py-2 align-top font-mono text-xs text-[#adb5bd]">
                    {row.rowNumber}
                  </td>
                  <td className="px-3 py-2 align-top text-[#1c2955]">
                    {row.subject || '-'}
                  </td>
                  <td className="px-3 py-2 align-top text-[#1c2955]">
                    {(row.type || '-').toUpperCase()}
                  </td>
                  <td className="px-3 py-2 align-top text-[#1c2955]">
                    <span className="line-clamp-2 max-w-md">
                      {row.text || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-[#6c757d]">
                    {answerSummary(row)}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {bad ? (
                      <span
                        title={row.error ?? ''}
                        className="inline-flex items-center text-[#b91c1c]"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[#10b981]">
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
          <strong className="font-semibold">
            {invalidCount} row{invalidCount === 1 ? '' : 's'} will be skipped.
          </strong>{' '}
          Hover the red icon to see why. Fix in your spreadsheet and re-upload,
          or click Import and the server will skip the invalid rows.
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={onReset}>
          <X className="h-4 w-4" /> Cancel
        </Button>
        <Button onClick={onSubmit} disabled={validCount === 0}>
          Import {validCount} question{validCount === 1 ? '' : 's'}
          {invalidCount > 0 && ` (skip ${invalidCount})`}
        </Button>
      </div>
    </div>
  )
}

function SubmittingView({ count }: { count: number }) {
  return (
    <div className="rounded-2xl border border-[#eef0f2] bg-white p-10 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4BA547]" />
      <p className="mt-4 text-base font-semibold text-[#1c2955]">
        Importing {count} question{count === 1 ? '' : 's'}...
      </p>
      <p className="mt-1 text-sm text-[#6c757d]">
        This usually takes a few seconds. Do not close this tab.
      </p>
    </div>
  )
}

function DoneView({
  result,
  onReset,
}: {
  result: BulkQuestionImportResult
  onReset: () => void
}) {
  if (!result.ok) {
    return (
      <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#b91c1c]" />
          <div>
            <h3 className="text-base font-semibold text-[#7f1d1d]">
              Import was rejected
            </h3>
            <p className="mt-1 text-sm text-[#991b1b]">
              {result.error ?? 'Unknown error.'}
            </p>
            <Button variant="outline" onClick={onReset} className="mt-4">
              <RotateCcw className="h-4 w-4" /> Try a different file
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const failedAvailable = result.failed.length > 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-[#16a34a]" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#166534]">
              {result.created} question{result.created === 1 ? '' : 's'} added
            </h3>
            <p className="mt-1 text-sm text-[#166534]/80">
              {result.created === 0
                ? 'Every row in this file was skipped. Fix the issues below and try again.'
                : 'They are active in the question bank and ready for your quiz events.'}
            </p>
          </div>
        </div>
      </div>

      {failedAvailable && (
        <div className="rounded-2xl border border-[#fed7aa] bg-[#fff7ed] p-5">
          <div className="mb-4 flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#ea580c]" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[#9a3412]">
                {result.failed.length} row
                {result.failed.length === 1 ? '' : 's'} skipped
              </h3>
              <p className="mt-1 text-sm text-[#9a3412]/80">
                These rows had validation problems and were not imported. Fix
                them in your spreadsheet and re-upload the corrected file.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#fed7aa] bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-[#fed7aa] bg-[#fff7ed]">
                <tr>
                  <th className="w-16 px-3 py-2 text-left font-semibold text-[#9a3412]">
                    Row
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[#9a3412]">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((f) => (
                  <tr key={f.rowNumber} className="border-b border-[#f1f5f9]">
                    <td className="px-3 py-2 align-top font-mono text-xs text-[#adb5bd]">
                      {f.rowNumber}
                    </td>
                    <td className="px-3 py-2 align-top text-[#9a3412]">
                      {f.reason}
                    </td>
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
          <a href="/dashboard/questions">View question bank</a>
        </Button>
      </div>
    </div>
  )
}

function ExpectedFormatCard() {
  const columns: Array<{ name: string; required: string; notes: string }> = [
    { name: 'type', required: 'Yes', notes: 'MCQ / MSQ / SHORT / LONG / ASSERTION_REASONING / CASE_BASED.' },
    { name: 'text', required: 'Yes', notes: 'Question prompt. For CASE_BASED, this is the case stem.' },
    {
      name: 'option_a ... option_f',
      required: 'MCQ/MSQ',
      notes: 'Option text. Fill from option_a with no gaps; min a + b. Ignored for other types (AR is auto-filled).',
    },
    {
      name: 'correct_answer',
      required: 'Most',
      notes: 'MCQ: one letter (b). MSQ: letters split by space (a c). SHORT: expected answer text. LONG / CASE_BASED: blank. ASSERTION_REASONING: 1/2/3/4 or a/b/c/d.',
    },
    { name: 'marks', required: 'Yes', notes: 'Whole number 1-100. For CASE_BASED, must equal the sum of sub-part marks.' },
    { name: 'difficulty', required: 'Yes', notes: 'EASY / MEDIUM / HARD.' },
    { name: 'subject', required: 'Yes', notes: 'e.g. Science, Mathematics.' },
    { name: 'topic', required: 'No', notes: 'Finer-grained tag.' },
    { name: 'chapter', required: 'No', notes: 'Chapter / unit name.' },
    {
      name: 'class',
      required: 'Yes*',
      notes:
        'Required — every question needs a class. Set it per row here (e.g. Class 10), or leave the column blank and pick the import-wide class above (*), which then applies to every row.',
    },
    { name: 'model_answer', required: 'No', notes: 'Explanation shown on the results page for wrong answers.' },
    { name: 'image_url', required: 'No', notes: 'Optional hosted image URL shown with the question.' },
    {
      name: 'subparts_json',
      required: 'CASE_BASED',
      notes: 'JSON array: [{"label":"A","text":"...","marks":1,"modelAnswer":"..."}]. Sub-part marks must sum to the marks column.',
    },
  ]

  return (
    <div className="rounded-2xl border border-[#eef0f2] bg-white p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-[#1c2955]">
          Expected CSV format
        </h2>
        <SampleDownloadButton variant="outline" />
      </div>

      <p className="text-sm leading-relaxed text-[#6c757d]">
        The first row must be the header. Columns can appear in any order and
        case does not matter. Every question needs a class: pick one for the
        whole import above, or add an optional <code>class</code> column to set
        it per row.
      </p>

      <div className="mt-3 overflow-x-auto rounded-lg border border-[#eef0f2] bg-[#f8f9fa]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eef0f2]">
              <th className="px-3 py-2 text-left font-semibold text-[#6c757d]">
                Column
              </th>
              <th className="px-3 py-2 text-left font-semibold text-[#6c757d]">
                Required
              </th>
              <th className="px-3 py-2 text-left font-semibold text-[#6c757d]">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {columns.map((col) => (
              <tr key={col.name} className="border-b border-[#f1f5f9]">
                <td className="whitespace-nowrap px-3 py-2 text-[#3f8c3c]">
                  {col.name}
                </td>
                <td
                  className={`px-3 py-2 ${col.required === 'No' ? 'text-[#adb5bd]' : 'text-[#1c2955]'}`}
                >
                  {col.required}
                </td>
                <td className="px-3 py-2 font-sans text-[#1c2955]">
                  {col.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-[#adb5bd]">
        Imported questions are active straight away. Re-importing the same
        file creates duplicates - the importer does not de-duplicate.
      </p>
    </div>
  )
}
