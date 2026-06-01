/**
 * Password hashing - bcryptjs (pure JS, no native build, fine on
 * Vercel + every CI). Cost factor 10 is the sane default for an
 * interactive login.
 */

import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'

const COST = 10

// Unambiguous alphabet for generated temp passwords: no 0/O/o, 1/l/I, so a
// password that's read off a screen and typed by hand can't be garbled.
const TEMP_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** A human-typable temporary password (default 12 chars, ~71 bits). */
export function generateTempPassword(length = 12): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]
  }
  return out
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
