/**
 * Unit tests for the pure (no-DB, no-I/O) logic the platform relies on.
 * Run with `npm test` (tsx + the Node built-in test runner). These cover
 * the bits where a silent regression would corrupt grades, onboarding or
 * billing - exactly the code that has no DB to lean on.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  matchesMcqMsq,
  scoreMcqMsq,
  matchesShort,
  scoreShort,
} from '../src/lib/scoring'
import { isAssignableRole, ROLE_LABEL } from '../src/lib/roles'
import {
  validateBulkUserRow,
  normalizeImportRole,
} from '../src/lib/user-import'
import { formatPrice, isFreePlan, parsePlanFeatures } from '../src/lib/plans'

// --------------------------------------------------------------------------
// scoring: MCQ / MSQ
// --------------------------------------------------------------------------
test('matchesMcqMsq: MCQ exact match', () => {
  assert.equal(matchesMcqMsq('MCQ', '"a"', '"a"'), true)
  assert.equal(matchesMcqMsq('MCQ', '"a"', '"b"'), false)
})

test('matchesMcqMsq: MSQ is an order-independent set match', () => {
  assert.equal(matchesMcqMsq('MSQ', '["a","c"]', '["c","a"]'), true)
  assert.equal(matchesMcqMsq('MSQ', '["a","c"]', '["a"]'), false)
  assert.equal(matchesMcqMsq('MSQ', '["a","c"]', '["a","c","d"]'), false)
})

test('matchesMcqMsq: blank / malformed is false', () => {
  assert.equal(matchesMcqMsq('MCQ', '"a"', null), false)
  assert.equal(matchesMcqMsq('MCQ', null, '"a"'), false)
  assert.equal(matchesMcqMsq('MCQ', '"a"', 'not-json'), false)
})

test('scoreMcqMsq: marks + negative marking', () => {
  // Use field-level assert.equal so a harmless -0 (penalty of 0) compares
  // equal to 0 (deepEqual.strict treats -0 and 0 as different via Object.is).
  const right = scoreMcqMsq('MCQ', '"a"', '"a"', 2, 0)
  assert.equal(right.isCorrect, true)
  assert.equal(right.marksAwarded, 2)

  const wrongNoNeg = scoreMcqMsq('MCQ', '"a"', '"b"', 2, 0)
  assert.equal(wrongNoNeg.isCorrect, false)
  // `+ 0` normalises a harmless -0 (penalty of 0) to +0 for strict equal.
  assert.equal(wrongNoNeg.marksAwarded + 0, 0)

  // 50% negative marking on a wrong 2-mark question = -1.
  const wrongNeg = scoreMcqMsq('MCQ', '"a"', '"b"', 2, 50)
  assert.equal(wrongNeg.marksAwarded, -1)

  // Blank answer is never penalised.
  const blank = scoreMcqMsq('MCQ', '"a"', null, 2, 50)
  assert.equal(blank.marksAwarded + 0, 0)
})

// --------------------------------------------------------------------------
// scoring: SHORT
// --------------------------------------------------------------------------
test('matchesShort: case + whitespace insensitive', () => {
  assert.equal(matchesShort('Mitochondria', '  mitochondria '), true)
  assert.equal(matchesShort('water cycle', 'Water   Cycle'), true)
  assert.equal(matchesShort('cat', 'dog'), false)
})

test('matchesShort: numeric values compare by value', () => {
  assert.equal(matchesShort('7', '7.0'), true)
  assert.equal(matchesShort('7', '8'), false)
})

test('matchesShort: tolerates a JSON-stored expected answer', () => {
  assert.equal(matchesShort('"Paris"', 'paris'), true)
})

test('scoreShort: awards full marks on a match, else zero', () => {
  assert.deepEqual(scoreShort('cat', 'CAT', 3), {
    isCorrect: true,
    marksAwarded: 3,
  })
  assert.deepEqual(scoreShort('cat', 'dog', 3), {
    isCorrect: false,
    marksAwarded: 0,
  })
})

// --------------------------------------------------------------------------
// roles
// --------------------------------------------------------------------------
test('isAssignableRole: only tenant roles, never SUPER_ADMIN', () => {
  assert.equal(isAssignableRole('TENANT_ADMIN'), true)
  assert.equal(isAssignableRole('TEACHER'), true)
  assert.equal(isAssignableRole('STUDENT'), true)
  assert.equal(isAssignableRole('SUPER_ADMIN'), false)
  assert.equal(isAssignableRole('nonsense'), false)
})

test('ROLE_LABEL covers every role', () => {
  assert.equal(ROLE_LABEL.STUDENT, 'Student')
  assert.equal(ROLE_LABEL.TENANT_ADMIN, 'Admin')
})

// --------------------------------------------------------------------------
// bulk user import
// --------------------------------------------------------------------------
test('normalizeImportRole: aliases + blank default', () => {
  assert.equal(normalizeImportRole('admin'), 'TENANT_ADMIN')
  assert.equal(normalizeImportRole('Teacher'), 'TEACHER')
  assert.equal(normalizeImportRole(''), 'STUDENT')
  assert.equal(normalizeImportRole(undefined), 'STUDENT')
  assert.equal(normalizeImportRole('wizard'), null)
})

test('validateBulkUserRow: accepts a good row', () => {
  assert.deepEqual(
    validateBulkUserRow({ name: 'Asha', email: 'asha@school.edu' }),
    { ok: true },
  )
})

test('validateBulkUserRow: rejects bad rows', () => {
  assert.equal(validateBulkUserRow({ email: 'a@b.com' }).ok, false)
  assert.equal(validateBulkUserRow({ name: 'A', email: 'nope' }).ok, false)
  assert.equal(
    validateBulkUserRow({ name: 'A', email: 'a@b.com', role: 'wizard' }).ok,
    false,
  )
  assert.equal(
    validateBulkUserRow({ name: 'A', email: 'a@b.com', password: 'short' }).ok,
    false,
  )
})

// --------------------------------------------------------------------------
// plans
// --------------------------------------------------------------------------
test('formatPrice: paise -> label, free is "Free"', () => {
  assert.equal(formatPrice(0), 'Free')
  assert.equal(formatPrice(49900), 'Rs 499 / mo')
})

test('isFreePlan', () => {
  assert.equal(isFreePlan(0), true)
  assert.equal(isFreePlan(100), false)
})

test('parsePlanFeatures: tolerant JSON parse', () => {
  assert.deepEqual(parsePlanFeatures('["a","b"]'), ['a', 'b'])
  assert.deepEqual(parsePlanFeatures('not json'), [])
  assert.deepEqual(parsePlanFeatures(null), [])
})
