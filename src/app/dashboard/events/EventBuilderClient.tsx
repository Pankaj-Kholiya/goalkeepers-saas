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
  classGrade?: string | null
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
  samplerClassGrade?: string
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
  classes = [],
  sponsors = [],
  defaults = {},
}: {
  questions: PickerQuestion[]
  subjects: string[]
  classes?: string[]
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
  // Pinned-picker class filter ('' = all classes).
  const [pinnedClass, setPinnedClass] = useState('')

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
    return questions.filter((item) => {
      // Untagged questions (null classGrade) are eligible for ANY class — keep
      // them visible under a class filter, matching the sampler + weekly
      // challenge rule (OR classGrade null).
      if (pinnedClass && item.classGrade && item.classGrade !== pinnedClass)
        return false
      if (!q) return true
      return (
        item.text.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)
      )
    })
  }, [filter, pinnedClass, questions])

  // When editing a draft, the stored sampler subject/class might no longer
  // exist in the current bank (its questions were deleted/deactivated). Keep
  // the stored value as an option so the Select shows it instead of going
  // blank — mirroring how QuestionForm preserves a legacy classGrade.
  const samplerSubjectOptions = useMemo(() => {
    const d = defaults.samplerSubject
    return d && d !== '__ALL__' && !subjects.includes(d)
      ? [d, ...subjects]
      : subjects
  }, [defaults.samplerSubject, subjects])
  const samplerClassOptions = useMemo(() => {
    const d = defaults.samplerClassGrade
    return d && d !== '__ALL__' && !classes.includes(d)
      ? [d, ...classes]
      : classes
  }, [defaults.samplerClassGrade, classes])

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Filter by text or subject..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="max-w-xs"
                  />
                  {classes.length > 0 ? (
                    <Select
                      value={pinnedClass || '__ALL__'}
                      onValueChange={(v) =>
                        setPinnedClass(v === '__ALL__' ? '' : v)
                      }
                    >
                      <SelectTrigger className="h-10 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ALL__">All classes</SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
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
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm text-[#1c2955]">
                            {q.text}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#adb5bd]">
                            {q.subject}
                            {q.classGrade ? ` · ${q.classGrade}` : ''} &middot;{' '}
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
              {/* Post EVERY selected id, even ones the current text/class
                  filter hides — so narrowing the filter never silently drops
                  a selection on submit. */}
              {Array.from(pinned).map((id) => (
                <input key={id} type="hidden" name="questionIds" value={id} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {samplerClassOptions.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="samplerClassGrade">Class</Label>
                  <Select
                    name="samplerClassGrade"
                    defaultValue={defaults.samplerClassGrade ?? '__ALL__'}
                  >
                    <SelectTrigger id="samplerClassGrade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">All classes</SelectItem>
                      {samplerClassOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-[#adb5bd]">
                    Auto-picks questions for this class (plus any untagged ones).
                    &quot;All classes&quot; ignores class.
                  </p>
                </div>
              ) : null}
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
                      {samplerSubjectOptions.map((s) => (
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
                  Difficulty{' '}
                  <span className="text-xs text-[#adb5bd]">
                    (optional - leave all 0 for any difficulty)
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
                  Only the difficulties you give a number to are drawn from
                  (e.g. Easy 10 → only Easy questions). The numbers also balance
                  the mix; the total count above is still honoured.
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

          {/* For ASYNC these two fields DEFINE the "take any time" window, so
              they're labelled as the window (not generic event timings) — the
              earlier wording read as redundant fixed timings. */}
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">
                {mode === 'LIVE' ? 'Starts' : 'Window opens'}{' '}
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
              {mode !== 'LIVE' ? (
                <p className="text-[10px] text-[#adb5bd]">
                  Students can start any time inside this window. Blank = opens
                  as soon as you publish.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">
                {mode === 'LIVE' ? 'Ends' : 'Window closes'}{' '}
                <span className="text-xs text-[#adb5bd]">(optional, IST)</span>
              </Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={defaults.endsAtLocal ?? ''}
              />
              {mode !== 'LIVE' ? (
                <p className="text-[10px] text-[#adb5bd]">
                  Blank = the window stays open until you close the event.
                </p>
              ) : null}
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
