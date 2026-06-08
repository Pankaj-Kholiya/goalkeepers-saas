/**
 * Quiz-event builder fields. Client component so the selection-mode
 * toggle (pinned vs. sampler) and the LIVE/ASYNC mode hint can swap
 * inputs live. Renders ONLY the fields - the parent /new page supplies
 * the <form action={createEventAction}> wrapper + submit button, so this
 * drops straight in (same pattern as QuestionForm).
 *
 * The server action (actions.ts) is the authoritative reader: it
 * re-parses this form into the canonical selection / settings JSON and
 * ignores anything not relevant to the chosen mode. Pinned mode posts a
 * `questionIds` checkbox per selected question; sampler mode posts a
 * subject + count + optional difficulty mix. The fixed question set is
 * only frozen at publish, so the builder stays editable while a draft.
 */

'use client'

import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** A question row the picker renders. Supplied by the server page from
 *  the tenant's active MCQ/MSQ bank. */
export interface PickerQuestion {
  id: string
  text: string
  subject: string
  difficulty: string
  marks: number
}

export interface EventBuilderDefaults {
  title?: string
  description?: string | null
  mode?: 'LIVE' | 'ASYNC'
  /** Pre-filled datetime-local strings (IST wall-clock) for editing. */
  startsAtLocal?: string
  endsAtLocal?: string
  selectionKind?: 'pinned' | 'sampler'
  pinnedIds?: string[]
  samplerSubject?: string
  samplerCount?: number
  mixEasy?: number
  mixMedium?: number
  mixHard?: number
  shuffleQuestions?: boolean
  shuffleOptions?: boolean
  timeLimitMin?: number
  leaderboardVisible?: boolean
  sponsorId?: string | null
}

/** A sponsor option for the optional sponsor picker. */
export interface SponsorOption {
  id: string
  name: string
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
}

export function EventBuilderClient({
  questions,
  subjects,
  sponsors = [],
  defaults = {},
}: {
  questions: PickerQuestion[]
  subjects: string[]
  sponsors?: SponsorOption[]
  defaults?: EventBuilderDefaults
}) {
  const [mode, setMode] = useState<'LIVE' | 'ASYNC'>(defaults.mode ?? 'ASYNC')
  const [selectionKind, setSelectionKind] = useState<'pinned' | 'sampler'>(
    defaults.selectionKind ?? 'pinned',
  )
  const [pinned, setPinned] = useState<Set<string>>(
    new Set(defaults.pinnedIds ?? []),
  )
  const [filter, setFilter] = useState('')

  const togglePinned = (id: string) => {
    setPinned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return questions
    return questions.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q),
    )
  }, [filter, questions])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* LEFT - title, description, question selection */}
      <div className="space-y-5 min-w-0">
        <div className="space-y-1.5">
          <Label htmlFor="title">Event title</Label>
          <Input
            id="title"
            name="title"
            type="text"
            required
            placeholder="Class 8 Science - Chapter 3 Quiz"
            defaultValue={defaults.title ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">
            Description{' '}
            <span className="text-xs text-[#adb5bd]">(optional)</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            placeholder="A short note shown to students before they start."
            defaultValue={defaults.description ?? ''}
          />
        </div>

        {/* Selection mode toggle */}
        <div className="space-y-3 rounded-2xl border border-[#eef0f2] bg-[#fafbfd] p-4">
          <input type="hidden" name="selectionKind" value={selectionKind} />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
              Questions
            </h3>
            <p className="mt-1 text-xs text-[#6c757d]">
              The set is frozen when you publish, so every student answers
              the same questions and the leaderboard is fair.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectionKind('pinned')}
              className={
                selectionKind === 'pinned'
                  ? 'rounded-md border border-[#4BA547] bg-[#F0FDF4] px-3 py-1.5 text-sm font-medium text-[#3f8c3c]'
                  : 'rounded-md border border-[#e6e8ec] bg-white px-3 py-1.5 text-sm text-[#475569] hover:border-[#4BA547] hover:bg-[#F0FDF4] hover:text-[#3f8c3c]'
              }
            >
              Pick questions
            </button>
            <button
              type="button"
              onClick={() => setSelectionKind('sampler')}
              className={
                selectionKind === 'sampler'
                  ? 'rounded-md border border-[#4BA547] bg-[#F0FDF4] px-3 py-1.5 text-sm font-medium text-[#3f8c3c]'
                  : 'rounded-md border border-[#e6e8ec] bg-white px-3 py-1.5 text-sm text-[#475569] hover:border-[#4BA547] hover:bg-[#F0FDF4] hover:text-[#3f8c3c]'
              }
            >
              Auto sampler
            </button>
          </div>

          {selectionKind === 'pinned' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Input
                  type="text"
                  placeholder="Filter by text or subject..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-xs"
                />
                <span className="shrink-0 text-xs font-medium text-[#6c757d]">
                  {pinned.size} selected
                </span>
              </div>
              {questions.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#e6e8ec] bg-white p-4 text-center text-sm text-[#6c757d]">
                  No active MCQ / MSQ questions in your bank yet. Add some in
                  the question bank first.
                </p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-[#e6e8ec] bg-white p-1">
                  {filtered.map((q) => {
                    const checked = pinned.has(q.id)
                    return (
                      <label
                        key={q.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-[#fafbfd]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePinned(q.id)}
                          className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
                        />
                        {/* Only checked boxes post their id to the action. */}
                        {checked ? (
                          <input
                            type="hidden"
                            name="questionIds"
                            value={q.id}
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm text-[#1c2955]">
                            {q.text}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#adb5bd]">
                            {q.subject} &middot;{' '}
                            {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}{' '}
                            &middot; {q.marks}{' '}
                            {q.marks === 1 ? 'mark' : 'marks'}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                  {filtered.length === 0 ? (
                    <p className="p-3 text-center text-sm text-[#adb5bd]">
                      No questions match that filter.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="samplerSubject">Subject</Label>
                  <Select
                    name="samplerSubject"
                    defaultValue={defaults.samplerSubject ?? '__ALL__'}
                  >
                    <SelectTrigger id="samplerSubject">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">All subjects</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-[#adb5bd]">
                    &quot;All subjects&quot; samples across your whole bank.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="samplerCount">How many questions</Label>
                  <Input
                    id="samplerCount"
                    name="samplerCount"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={defaults.samplerCount ?? 10}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Difficulty mix{' '}
                  <span className="text-xs text-[#adb5bd]">
                    (optional - leave 0 to ignore)
                  </span>
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="mb-1 block text-xs text-[#6c757d]">
                      Easy
                    </span>
                    <Input
                      name="mixEasy"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={defaults.mixEasy ?? 0}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs text-[#6c757d]">
                      Medium
                    </span>
                    <Input
                      name="mixMedium"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={defaults.mixMedium ?? 0}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs text-[#6c757d]">
                      Hard
                    </span>
                    <Input
                      name="mixHard"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={defaults.mixHard ?? 0}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#adb5bd]">
                  A soft target used to balance the draw. The sampler still
                  honours the total count above.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT - mode, schedule, settings */}
      <aside className="space-y-4 min-w-0">
        <div className="rounded-2xl border border-[#eef0f2] bg-[#fafbfd] p-4 space-y-4 lg:sticky lg:top-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
            Setup
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="mode">Mode</Label>
            <input type="hidden" name="mode" value={mode} />
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as 'LIVE' | 'ASYNC')}
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASYNC">
                  Async - take any time in a window
                </SelectItem>
                <SelectItem value="LIVE">Live - host driven</SelectItem>
              </SelectContent>
            </Select>
            {mode === 'LIVE' ? (
              <p className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-2 text-[10px] leading-snug text-[#9a3412]">
                Live mode is coming soon. You can create and publish a live
                event, but the real-time runner is not shipped yet.
              </p>
            ) : (
              <p className="text-[10px] text-[#adb5bd]">
                Students attempt any time inside the window below. Leave the
                dates blank to open immediately with no close time.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">
                Opens{' '}
                <span className="text-xs text-[#adb5bd]">
                  ({mode === 'LIVE' ? 'required, ' : 'optional, '}IST)
                </span>
              </Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required={mode === 'LIVE'}
                defaultValue={defaults.startsAtLocal ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">
                Closes{' '}
                <span className="text-xs text-[#adb5bd]">(optional, IST)</span>
              </Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={defaults.endsAtLocal ?? ''}
              />
            </div>
          </div>

          <div className="space-y-1.5 border-t border-[#e8ecf2] pt-3">
            <Label htmlFor="timeLimitMin">
              Time limit{' '}
              <span className="text-xs text-[#adb5bd]">
                (minutes, 0 = none)
              </span>
            </Label>
            <Input
              id="timeLimitMin"
              name="timeLimitMin"
              type="number"
              min={0}
              step={1}
              defaultValue={defaults.timeLimitMin ?? 0}
            />
          </div>

          <div className="space-y-2 border-t border-[#e8ecf2] pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="shuffleQuestions"
                defaultChecked={defaults.shuffleQuestions ?? false}
                className="h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
              />
              <span className="text-[#1c2955]">Shuffle question order</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="shuffleOptions"
                defaultChecked={defaults.shuffleOptions ?? false}
                className="h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
              />
              <span className="text-[#1c2955]">Shuffle option order</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="leaderboardVisible"
                defaultChecked={defaults.leaderboardVisible ?? true}
                className="h-4 w-4 rounded border-[#cbd5e1] accent-[#4BA547]"
              />
              <span className="text-[#1c2955]">
                Show leaderboard to students
              </span>
            </label>
          </div>

          {sponsors.length > 0 ? (
            <div className="space-y-1.5 border-t border-[#e8ecf2] pt-3">
              <Label htmlFor="sponsorId">
                Sponsor{' '}
                <span className="text-xs text-[#adb5bd]">(optional)</span>
              </Label>
              <Select
                name="sponsorId"
                defaultValue={defaults.sponsorId ?? '__NONE__'}
              >
                <SelectTrigger id="sponsorId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">No sponsor</SelectItem>
                  {sponsors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-[#adb5bd]">
                Their logo rides along on the screens you enabled for them.
              </p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
