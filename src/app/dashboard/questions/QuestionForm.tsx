/**
 * Shared form fields for Question create + edit.
 *
 * Client component so the option / answer / sub-parts inputs can swap
 * based on the currently-selected type. It renders ONLY the fields -
 * the parent page supplies the <form action={...}> wrapper + the
 * submit button, so this drops in for both /new and /[id]/edit.
 *
 * The author types a friendly format (one option per line for MCQ /
 * MSQ, a sub-parts JSON array for case-based). The server action
 * (actions.ts) re-parses it into the canonical stored JSON via
 * src/lib/questions.ts and is the authoritative validator.
 *
 * Conditional fields by type:
 *   MCQ                  - options textarea + correct answer line number
 *   MSQ                  - options textarea + correct answer line numbers
 *   SHORT                - expected-answer text input (no options)
 *   LONG                 - no options / no answer (model answer is the rubric)
 *   ASSERTION_REASONING  - author picks 1-4 only (options auto-filled)
 *   CASE_BASED           - sub-parts JSON editor; case stem on the text field
 */

'use client'

import { useState } from 'react'
import type { Difficulty, QuestionType } from '@prisma/client'

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
import { SymbolToolbar } from '@/components/forms/SymbolToolbar'
import { optionsToTextarea, correctAnswerToInput } from '@/lib/questions'
import { CLASS_GRADES } from '@/lib/classes'

export interface QuestionFormDefaults {
  text?: string
  type?: QuestionType
  options?: string | null
  correctAnswer?: string | null
  modelAnswer?: string | null
  marks?: number
  subject?: string
  chapter?: string | null
  topic?: string | null
  classGrade?: string | null
  difficulty?: Difficulty
  imageUrl?: string | null
  subParts?: string | null
  isActive?: boolean
}

export function QuestionForm({
  defaults = {},
}: {
  defaults?: QuestionFormDefaults
}) {
  const initialType: QuestionType = defaults.type ?? 'MCQ'
  const [type, setType] = useState<QuestionType>(initialType)

  // Mirror marks as state so the case-based hint can echo the current
  // total. Server still re-validates the sub-part sum on save.
  const [marks, setMarks] = useState<number>(defaults.marks ?? 1)

  const optionsText = optionsToTextarea(defaults.options)
  const correctText = correctAnswerToInput(
    defaults.correctAnswer,
    initialType,
    defaults.options,
  )

  // Class dropdown options: the canonical list, plus this question's existing
  // class if it's a legacy value not in the list (so editing never silently
  // drops it).
  const classOptions: string[] =
    defaults.classGrade && !CLASS_GRADES.includes(defaults.classGrade as never)
      ? [defaults.classGrade, ...CLASS_GRADES]
      : [...CLASS_GRADES]

  const showOptions = type === 'MCQ' || type === 'MSQ'
  const showShortAnswer = type === 'SHORT'
  const showARChoice = type === 'ASSERTION_REASONING'
  const showSubParts = type === 'CASE_BASED'
  // LONG hides both options and the correct answer entirely - the model
  // answer doubles as the grading rubric.

  // Only pre-fill the answer field when the stored type matches the
  // field we are rendering, so switching type in the form starts clean.
  const answerDefault = type === initialType ? correctText : ''

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* =========================================================
          LEFT COLUMN - the question's content. Wider so the textareas
          (question text, options, sub-parts JSON, model answer) have
          room to breathe.
          ====================================================== */}
      <div className="space-y-5 min-w-0">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="text">
              {showSubParts ? 'Case stem' : 'Question text'}
            </Label>
            <SymbolToolbar targetId="text" />
          </div>
          <Textarea
            id="text"
            name="text"
            rows={4}
            required
            placeholder={
              showSubParts
                ? 'Read the passage carefully and answer the questions that follow...'
                : showARChoice
                  ? 'Assertion (A): ...\nReason (R): ...'
                  : 'If x + 5 = 12, what is the value of x?'
            }
            defaultValue={defaults.text ?? ''}
          />
        </div>

        {/* Type-specific blocks. Only the field relevant to the
            currently-selected type renders; the server re-validates
            from scratch on save. */}

        {showOptions && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label htmlFor="options">
                  Options{' '}
                  <span className="text-xs text-[#adb5bd]">
                    (one per line, max 6)
                  </span>
                </Label>
                <SymbolToolbar targetId="options" />
              </div>
              <Textarea
                id="options"
                name="options"
                rows={4}
                placeholder={`Option 1 text
Option 2 text
Option 3 text
Option 4 text`}
                defaultValue={optionsText}
              />
              <p className="text-xs text-[#adb5bd]">
                Auto-assigned ids: line 1 = a, line 2 = b, line 3 = c, etc.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="correctAnswer">
                Correct answer{' '}
                <span className="text-xs text-[#adb5bd]">
                  ({type === 'MCQ'
                    ? 'a single line number'
                    : 'comma-separated line numbers'})
                </span>
              </Label>
              <Input
                id="correctAnswer"
                name="correctAnswer"
                type="text"
                placeholder={type === 'MCQ' ? '2' : '1,3'}
                defaultValue={answerDefault}
              />
              <p className="text-xs text-[#adb5bd]">
                Enter the option line numbers (1-indexed). E.g.,
                &ldquo;2&rdquo; for the second option (MCQ), or
                &ldquo;1,3&rdquo; for the first and third options (MSQ).
              </p>
            </div>
          </>
        )}

        {showShortAnswer && (
          <div className="space-y-1.5">
            <Label htmlFor="correctAnswer">
              Expected answer{' '}
              <span className="text-xs text-[#adb5bd]">
                (matched on submit)
              </span>
            </Label>
            <Input
              id="correctAnswer"
              name="correctAnswer"
              type="text"
              placeholder="e.g. 7 / Newton / The mitochondria"
              defaultValue={answerDefault}
            />
            <p className="text-xs text-[#adb5bd]">
              The expected answer for this short-answer question. Shown as
              the model answer for context on the results page.
            </p>
          </div>
        )}

        {showARChoice && (
          <div className="space-y-1.5">
            <Label htmlFor="correctAnswer">
              Correct option{' '}
              <span className="text-xs text-[#adb5bd]">(1, 2, 3, or 4)</span>
            </Label>
            <Input
              id="correctAnswer"
              name="correctAnswer"
              type="text"
              placeholder="1"
              defaultValue={answerDefault}
            />
            <div className="rounded-md border border-[#e8ecf2] bg-[#fafbfd] p-2.5 text-xs text-[#6c757d] leading-relaxed">
              <p className="font-semibold text-[#1c2955] mb-1">
                Auto-filled options (CBSE standard):
              </p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>
                  Both Assertion (A) and Reason (R) are true and Reason (R)
                  is the correct explanation of Assertion (A).
                </li>
                <li>
                  Both Assertion (A) and Reason (R) are true but Reason (R)
                  is not the correct explanation of Assertion (A).
                </li>
                <li>Assertion (A) is true but Reason (R) is false.</li>
                <li>Assertion (A) is false but Reason (R) is true.</li>
              </ol>
            </div>
          </div>
        )}

        {showSubParts && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="subParts">Sub-parts (JSON)</Label>
              <SymbolToolbar targetId="subParts" />
            </div>
            <Textarea
              id="subParts"
              name="subParts"
              rows={6}
              className="font-mono text-xs"
              placeholder={`[
  { "label": "A", "text": "...", "marks": 1 },
  { "label": "B", "text": "...", "marks": 2, "modelAnswer": "..." }
]`}
              defaultValue={defaults.subParts ?? ''}
            />
            <p className="text-xs text-[#adb5bd]">
              A JSON array of sub-parts. The sub-part marks must sum to the
              total marks ({marks}). Each item needs a label, text, and
              positive marks; modelAnswer is optional.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="imageUrl">
            Image URL{' '}
            <span className="text-xs text-[#adb5bd]">(optional)</span>
          </Label>
          <Input
            id="imageUrl"
            name="imageUrl"
            type="text"
            placeholder="https://... (a diagram shown with the question)"
            defaultValue={defaults.imageUrl ?? ''}
          />
          <p className="text-xs text-[#adb5bd]">
            Optional diagram shown alongside the question. Paste a hosted
            image URL.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label htmlFor="modelAnswer">
              Explanation / model answer{' '}
              <span className="text-xs text-[#adb5bd]">(optional)</span>
            </Label>
            <SymbolToolbar targetId="modelAnswer" />
          </div>
          <Textarea
            id="modelAnswer"
            name="modelAnswer"
            rows={4}
            placeholder="Why the correct option is correct (or, for SHORT / LONG, the rubric to grade against)."
            defaultValue={defaults.modelAnswer ?? ''}
          />
          <p className="text-xs text-[#adb5bd]">
            Shown on the results page for questions a student got wrong.
          </p>
        </div>
      </div>

      {/* =========================================================
          RIGHT COLUMN - classification / metadata. A tinted card so it
          reads as the "settings panel". Sticks to the top on tall
          screens so the author can change the type / marks while
          scrolling the long content column.
          ====================================================== */}
      <aside className="space-y-4 min-w-0">
        <div className="rounded-2xl border border-[#eef0f2] bg-[#fafbfd] p-4 space-y-4 lg:sticky lg:top-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#adb5bd]">
            Classification
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select
              name="type"
              value={type}
              onValueChange={(v) => setType(v as QuestionType)}
              required
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MCQ">MCQ - single correct</SelectItem>
                <SelectItem value="MSQ">MSQ - multiple correct</SelectItem>
                <SelectItem value="SHORT">Short answer</SelectItem>
                <SelectItem value="LONG">Long answer</SelectItem>
                <SelectItem value="ASSERTION_REASONING">
                  Assertion-Reasoning
                </SelectItem>
                <SelectItem value="CASE_BASED">
                  Case-based (with sub-parts)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                name="difficulty"
                defaultValue={defaults.difficulty ?? 'MEDIUM'}
                required
              >
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="marks">Marks</Label>
              <Input
                id="marks"
                name="marks"
                type="number"
                min={1}
                max={100}
                // step={1} blocks the browser spinner from typing
                // 1.5 / 2.7; the server also rejects non-integers.
                step={1}
                value={marks}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setMarks(Number.isFinite(n) ? n : 0)
                }}
                required
              />
              {showSubParts && (
                <p className="text-[10px] text-[#adb5bd] leading-snug">
                  Must equal the sum of sub-part marks.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              type="text"
              required
              placeholder="Mathematics"
              defaultValue={defaults.subject ?? ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="topic">
                Topic{' '}
                <span className="text-xs text-[#adb5bd]">(optional)</span>
              </Label>
              <Input
                id="topic"
                name="topic"
                type="text"
                placeholder="Algebra"
                defaultValue={defaults.topic ?? ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chapter">
                Chapter{' '}
                <span className="text-xs text-[#adb5bd]">(optional)</span>
              </Label>
              <Input
                id="chapter"
                name="chapter"
                type="text"
                placeholder="Linear Equations"
                defaultValue={defaults.chapter ?? ''}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="classGrade">
              Class <span className="text-[#dc2626]">*</span>
            </Label>
            {/* No native `required` here: Radix backs a named Select with a
                clipped (unfocusable) hidden <select>, and a required+empty one
                makes Chromium silently refuse to submit. The server action is
                the authoritative "Class is required" guard. */}
            <Select
              name="classGrade"
              defaultValue={defaults.classGrade ?? undefined}
            >
              <SelectTrigger id="classGrade">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[#adb5bd]">
              Drives grade-based filtering, sorting and quiz / challenge
              auto-select.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm pt-2 border-t border-[#e8ecf2]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaults.isActive ?? true}
              className="w-4 h-4 rounded border-[#cbd5e1] accent-[#4BA547]"
            />
            <span>
              <span className="font-medium text-[#1c2955]">Active</span>
              <span className="text-[#6c757d] ml-1 text-xs">
                (available in quiz events)
              </span>
            </span>
          </label>
        </div>
      </aside>
    </div>
  )
}
