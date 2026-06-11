/**
 * Filter + sort controls for the question bank: Class, Subject, Difficulty,
 * a free-text search, and the sort order. Client component: every change is
 * written into the URL search params and the server page re-queries — so a
 * filtered view is shareable and survives a refresh. The search input
 * debounces (300ms) to avoid a server render per keystroke.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Input } from '@/components/ui/input'
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
const DIFFICULTIES = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
] as const

export function QuestionFilters({
  classes,
  subjects,
  selectedClass,
  selectedSubject,
  selectedDifficulty,
  selectedQuery,
  selectedSort,
}: {
  classes: string[]
  subjects: string[]
  selectedClass: string | null
  selectedSubject: string | null
  selectedDifficulty: string | null
  selectedQuery: string
  selectedSort: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = useState(selectedQuery)
  const debounceRef = useRef<number | null>(null)

  // Clear a pending search debounce on unmount, so navigating away can't fire
  // a stale router.replace afterwards.
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function onSearchChange(value: string) {
    setQuery(value)
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setParam('q', value.trim() || null)
    }, 300)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-1.5 sm:max-w-72">
        <Label htmlFor="filter-q" className="text-xs text-ink-subtle">
          Search
        </Label>
        <Input
          id="filter-q"
          type="search"
          placeholder="Search question text…"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-class" className="text-xs text-ink-subtle">
          Class
        </Label>
        <Select
          value={selectedClass ?? ALL}
          onValueChange={(v) => setParam('class', v === ALL ? null : v)}
        >
          <SelectTrigger id="filter-class" className="h-9 w-40">
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
        <Label htmlFor="filter-subject" className="text-xs text-ink-subtle">
          Subject
        </Label>
        <Select
          value={selectedSubject ?? ALL}
          onValueChange={(v) => setParam('subject', v === ALL ? null : v)}
        >
          <SelectTrigger id="filter-subject" className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-difficulty" className="text-xs text-ink-subtle">
          Difficulty
        </Label>
        <Select
          value={selectedDifficulty ?? ALL}
          onValueChange={(v) => setParam('difficulty', v === ALL ? null : v)}
        >
          <SelectTrigger id="filter-difficulty" className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All levels</SelectItem>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
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
          <SelectTrigger id="filter-sort" className="h-9 w-40">
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
