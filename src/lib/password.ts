/**
 * Password hashing - bcryptjs (pure JS, no native build, fine on
 * Vercel + every CI). Cost factor 10 is the sane default for an
 * interactive login.
 */

import bcrypt from 'bcryptjs'

const COST = 10

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
