/**
 * Question bank table (client). Adds row selection on top of the list: tick
 * questions (or select-all) and delete them in one confirmed action, plus the
 * per-row Edit / Delete. Deletes call their server action via a transition and
 * toast the outcome — questions frozen into a published/live event or an open
 * weekly challenge are skipped by the server and reported, never destroyed.
 */

'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Trash2 } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { useToast } from '@/components/toast'
import { deleteQuestionAction, bulkDeleteQuestionsAction } from './actions'

const TYPE_LABEL: Record<string, string> = {
  MCQ: 'MCQ',
  MSQ: 'MSQ',
  SHORT: 'Short',
  LONG: 'Long',
  ASSERTION_REASONING: 'A-R',
  CASE_BASED: 'Case',
}

export interface QuestionRow {
  id: string
  type: string
  text: string
  subject: string
  topic: string | null
  classGrade: string | null
  marks: number
  isActive: boolean
}

export function QuestionsTable({ questions }: { questions: QuestionRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const toast = useToast()
  const router = useRouter()

  const allSelected =
    questions.length > 0 && questions.every((q) => selected.has(q.id))
  const selectedCount = useMemo(
    () => questions.filter((q) => selected.has(q.id)).length,
    [questions, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(questions.map((q) => q.id)))
  }

  function deleteOne(id: string) {
    if (!window.confirm("Delete this question? This can't be undone.")) return
    startTransition(async () => {
      const res = await deleteQuestionAction({ id })
      if (res.ok) {
        toast.success('Question deleted.')
        setSelected((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function deleteSelected() {
    const ids = questions.filter((q) => selected.has(q.id)).map((q) => q.id)
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Delete ${ids.length} selected question${ids.length === 1 ? '' : 's'}? This can't be undone. Questions used by a live event or open challenge will be skipped.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const res = await bulkDeleteQuestionsAction({ ids })
      if (res.ok) {
        toast.success(
          `${res.deleted} deleted` +
            (res.skipped > 0
              ? `, ${res.skipped} skipped (in use by a live event or open challenge)`
              : '') +
            '.',
        )
        setSelected(new Set())
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — appears once anything is ticked. */}
      {selectedCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-accent-soft px-4 py-2">
          <span className="text-sm font-medium text-ink">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={deleteSelected}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {pending ? 'Deleting…' : `Delete selected (${selectedCount})`}
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <tr>
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label="Select all questions"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
              />
            </TableHead>
            <TableHead>Question</TableHead>
            <TableHead className="w-20">Type</TableHead>
            <TableHead>Subject / topic</TableHead>
            <TableHead className="w-28">Class</TableHead>
            <TableHead className="w-20 text-right">Marks</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {questions.map((q) => (
            <TableRow key={q.id}>
              <TableCell className="align-top">
                <input
                  type="checkbox"
                  aria-label={`Select question: ${q.text.slice(0, 60)}`}
                  checked={selected.has(q.id)}
                  onChange={() => toggle(q.id)}
                  className="h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
                />
              </TableCell>
              <TableCell className="align-top">
                <Link
                  href={`/dashboard/questions/${q.id}/edit`}
                  className="line-clamp-2 max-w-md font-medium hover:text-brand-deep"
                >
                  {q.text}
                </Link>
              </TableCell>
              <TableCell className="align-top">
                <Badge variant="neutral">{TYPE_LABEL[q.type] ?? q.type}</Badge>
              </TableCell>
              <TableCell className="align-top">
                <span className="text-ink">{q.subject}</span>
                {q.topic ? (
                  <span className="block text-xs text-ink-faint">{q.topic}</span>
                ) : null}
              </TableCell>
              <TableCell className="align-top">
                {q.classGrade ? (
                  <span className="text-ink-subtle">{q.classGrade}</span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {q.marks}
              </TableCell>
              <TableCell className="align-top">
                {q.isActive ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="neutral">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/dashboard/questions/${q.id}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => deleteOne(q.id)}
                    className="text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
