/**
 * Class + sort controls for the question bank. Client component: each change
 * is written into the URL search params (?class=, ?sort=) and the server page
 * re-queries. Keeping the state in the URL makes a filtered view shareable and
 * survives a refresh.
 */

'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export const QUESTION_SORTS = [
  { value: 'created_desc', label: 'Newest first' },
  { value: 'created_asc', label: 'Oldest first' },
  { value: 'class_asc', label: 'Class (A–Z)' },
  { value: 'subject_asc', label: 'Subject (A–Z)' },
] as const

const ALL = '__ALL__'

export function QuestionFilters({
  classes,
  selectedClass,
  selectedSort,
}: {
  classes: string[]
  selectedClass: string | null
  selectedSort: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="filter-class" className="text-xs text-ink-subtle">
          Class
        </Label>
        <Select
          value={selectedClass ?? ALL}
          onValueChange={(v) => setParam('class', v === ALL ? null : v)}
        >
          <SelectTrigger id="filter-class" className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-sort" className="text-xs text-ink-subtle">
          Sort by
        </Label>
        <Select
          value={selectedSort}
          onValueChange={(v) =>
            setParam('sort', v === 'created_desc' ? null : v)
          }
        >
          <SelectTrigger id="filter-sort" className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
