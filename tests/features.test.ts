/**
 * Unit tests for the pure logic added with the Archive/Delete-schools,
 * mandatory-Class, and class-aware quiz-selection features. No DB / I/O.
 * Run with `npm test` (tsx + the Node built-in test runner).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CLASS_GRADES,
  isValidClassGrade,
  sortClassGrades,
} from '../src/lib/classes'
import {
  validateBulkQuestionRow,
  parseImageUrl,
  type BulkQuestionRow,
} from '../src/lib/questions'
import { parseSelection, serializeSelection } from '../src/lib/quiz'
import { restoredStatus } from '../src/lib/archive'
import { isChallengeOpen } from '../src/lib/weekly-challenge'

// --------------------------------------------------------------------------
// classes: canonical list + helpers
// --------------------------------------------------------------------------
test('isValidClassGrade: only the canonical labels match', () => {
  assert.equal(isValidClassGrade('Class 10'), true)
  assert.equal(isValidClassGrade('Nursery'), true)
  assert.equal(isValidClassGrade('class 10'), false) // case-sensitive
  assert.equal(isValidClassGrade('Grade 10'), false)
  assert.equal(isValidClassGrade(''), false)
})

test('sortClassGrades: canonical order first, legacy values appended A–Z', () => {
  const sorted = sortClassGrades(['Class 10', 'Grade 5', 'Class 2', 'Nursery', 'Aardvark'])
  assert.deepEqual(sorted, ['Nursery', 'Class 2', 'Class 10', 'Aardvark', 'Grade 5'])
})

test('sortClassGrades: dedupes + trims, ignores blanks', () => {
  const sorted = sortClassGrades(['Class 1', ' Class 1 ', '', '  '])
  assert.deepEqual(sorted, ['Class 1'])
})

test('CLASS_GRADES: covers Nursery → Class 12', () => {
  assert.equal(CLASS_GRADES[0], 'Nursery')
  assert.equal(CLASS_GRADES[CLASS_GRADES.length - 1], 'Class 12')
})

// --------------------------------------------------------------------------
// bulk import: class resolution (row column vs import default vs missing)
// --------------------------------------------------------------------------
const baseRow: BulkQuestionRow = {
  type: 'MCQ',
  text: 'If x + 5 = 12, what is x?',
  option_a: '5',
  option_b: '7',
  correct_answer: 'b',
  marks: '1',
  difficulty: 'EASY',
  subject: 'Mathematics',
}

test('validateBulkQuestionRow: per-row class column is used', () => {
  const res = validateBulkQuestionRow({ ...baseRow, class: 'Class 5' })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.data.classGrade, 'Class 5')
})

test('validateBulkQuestionRow: falls back to the import-wide class', () => {
  const res = validateBulkQuestionRow(baseRow, { classGrade: 'Class 6' })
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.data.classGrade, 'Class 6')
})

test('validateBulkQuestionRow: row class overrides the import default', () => {
  const res = validateBulkQuestionRow(
    { ...baseRow, class: 'Class 5' },
    { classGrade: 'Class 6' },
  )
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.data.classGrade, 'Class 5')
})

test('validateBulkQuestionRow: class is required (neither row nor default)', () => {
  const res = validateBulkQuestionRow(baseRow)
  assert.equal(res.ok, false)
  if (!res.ok) assert.match(res.error, /class is required/i)
})

// --------------------------------------------------------------------------
// quiz selection: sampler classGrade round-trips through parse/serialize
// --------------------------------------------------------------------------
test('parseSelection: sampler classGrade survives a round-trip', () => {
  const json = serializeSelection({
    kind: 'sampler',
    subject: 'Science',
    classGrade: 'Class 8',
    count: 10,
  })
  const parsed = parseSelection(json)
  assert.equal(parsed.kind, 'sampler')
  if (parsed.kind === 'sampler') {
    assert.equal(parsed.classGrade, 'Class 8')
    assert.equal(parsed.subject, 'Science')
    assert.equal(parsed.count, 10)
  }
})

test('parseSelection: absent classGrade stays undefined (no filter)', () => {
  const parsed = parseSelection(
    serializeSelection({ kind: 'sampler', count: 5 }),
  )
  assert.equal(parsed.kind, 'sampler')
  if (parsed.kind === 'sampler') assert.equal(parsed.classGrade, undefined)
})

// --------------------------------------------------------------------------
// archive: the status a restored school returns to
// --------------------------------------------------------------------------
test('restoredStatus: returns the exact pre-archive status', () => {
  assert.equal(restoredStatus('ACTIVE'), 'ACTIVE')
  assert.equal(restoredStatus('TRIAL'), 'TRIAL')
  assert.equal(restoredStatus('SUSPENDED'), 'SUSPENDED')
})

test('restoredStatus: falls back to SUSPENDED when unknown', () => {
  assert.equal(restoredStatus(null), 'SUSPENDED')
  assert.equal(restoredStatus(undefined), 'SUSPENDED')
})

// --------------------------------------------------------------------------
// parseImageUrl: only http(s) absolute URLs survive (XSS-sink guard)
// --------------------------------------------------------------------------
test('parseImageUrl: accepts http(s), rejects dangerous/other schemes', () => {
  assert.equal(parseImageUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png')
  assert.equal(parseImageUrl('http://example.com/x.jpg'), 'http://example.com/x.jpg')
  assert.equal(parseImageUrl('  https://example.com/y.png  '), 'https://example.com/y.png')
  assert.equal(parseImageUrl('javascript:alert(1)'), null)
  assert.equal(parseImageUrl('data:image/png;base64,AAAA'), null)
  assert.equal(parseImageUrl('/relative/path.png'), null)
  assert.equal(parseImageUrl(''), null)
  assert.equal(parseImageUrl(null), null)
  assert.equal(parseImageUrl('not a url'), null)
})

// --------------------------------------------------------------------------
// isChallengeOpen: now must fall within [openedAt, closedAt)
// --------------------------------------------------------------------------
test('isChallengeOpen: only true strictly inside the window', () => {
  const now = Date.now()
  const open = new Date(now - 60_000) // opened a minute ago
  const close = new Date(now + 60_000) // closes in a minute
  assert.equal(isChallengeOpen(open, close), true)
  // Already closed.
  assert.equal(isChallengeOpen(new Date(now - 120_000), new Date(now - 60_000)), false)
  // Not yet open.
  assert.equal(isChallengeOpen(new Date(now + 60_000), new Date(now + 120_000)), false)
})
