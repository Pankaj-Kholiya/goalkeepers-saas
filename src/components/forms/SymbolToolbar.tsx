/**
 * SymbolToolbar - one-click unicode insert above a text input.
 *
 * Why: Question text + options + sub-parts + model answers need
 * subscript (H₂O), superscript (x²), arrows (→), and math/Greek
 * (∫ π Δ) characters. The data layer already accepts every unicode
 * codepoint (textarea is plain, Question.text is `String @db.Text`,
 * the print render uses Noto Serif which has full coverage), but
 * admins don't have a fast way to TYPE them. This toolbar surfaces
 * the common ones one click away.
 *
 * Works with both controlled and uncontrolled targets. We mutate the
 * native `value` via the prototype-descriptor setter and dispatch
 * the `input` event so React's value-tracker picks up the change on
 * controlled inputs (the standard "programmatic input change" dance).
 *
 * Usage:
 *   <SymbolToolbar targetId="question-text" />
 *   <textarea id="question-text" ... />
 *
 * Click a category pill -> a popover with the group's symbols opens
 * below it. Click a symbol -> inserted at the cursor of the target
 * input. The popover stays open so admins can chain multiple inserts;
 * a second click on the same pill closes it.
 */

'use client'

import { useEffect, useRef, useState } from 'react'

// =========================================================================
// Paste-time unicode rewriter
// =========================================================================
//
// Why this exists: admins routinely copy CBSE / NCERT content from Word,
// Google Docs, textbook PDFs and chemistry sites. Most of those sources
// don't store "H₂O" as the actual unicode character ₂ (U+2082); they
// store plain digit "2" with HTML <sub> formatting around it. When you
// paste rich text into a plain <textarea>, the browser strips the
// formatting and keeps only the plain text - so the paste arrives as
// "H2O" and the admin thinks unicode is broken.
//
// Fix: intercept paste, look at the clipboard's text/html payload
// (which DOES survive the strip), walk it, and convert <sub>X</sub>
// + <sup>X</sup> wrappers into the unicode subscript / superscript
// equivalents BEFORE the text lands in the field. The toolbar pills
// already inserted real unicode chars, so this brings paste into
// parity with the click experience.
//
// Characters that don't have a Unicode super/subscript equivalent
// (e.g. <sup>?</sup>) fall back to the plain character so we never
// silently drop content.

const SUB_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
}

const SUP_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  i: 'ⁱ',
  n: 'ⁿ',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  o: 'ᵒ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
}

function mapChars(text: string, table: Record<string, string>): string {
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    out += table[lower] ?? table[ch] ?? ch
  }
  return out
}

/**
 * Walk a parsed-HTML node and emit plain text with <sub>/<sup>
 * children rewritten to unicode. Recursion is on purpose so nested
 * tags (a <sup> inside a <sub>, a <b> wrapping a <sub>, etc.) all
 * unwind correctly.
 */
function nodeToUnicodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const inner = Array.from(el.childNodes).map(nodeToUnicodeText).join('')
    if (tag === 'sub') return mapChars(inner, SUB_MAP)
    if (tag === 'sup') return mapChars(inner, SUP_MAP)
    return inner
  }
  // Comments, etc. - skip.
  return ''
}

/**
 * Parse a clipboard text/html payload and return plain text with
 * sub/sup-to-unicode substitution applied. Returns null when
 * parsing fails so the caller can fall back to default paste.
 */
function htmlClipboardToUnicodeText(html: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (!doc.body) return null
    return nodeToUnicodeText(doc.body)
  } catch {
    return null
  }
}

interface SymbolGroup {
  label: string
  symbols: string[]
  /** Optional shorter label for small screens / dense rows. */
  short?: string
}

// Curated to ~16 symbols per group so the popover stays compact.
// Order roughly by frequency in CBSE Class IX-XII papers.
const GROUPS: SymbolGroup[] = [
  {
    label: 'Subscript',
    short: 'Sub',
    symbols: [
      '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉',
      '₊', '₋', 'ₐ', 'ₑ', 'ₒ', 'ₓ',
    ],
  },
  {
    label: 'Superscript',
    short: 'Sup',
    symbols: [
      '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹',
      '⁺', '⁻', '°', '′', '″', 'ⁿ',
    ],
  },
  {
    label: 'Math',
    symbols: [
      '×', '÷', '±', '∓', '≠', '≤', '≥', '≈',
      '∞', '√', '∛', '∫', '∑', '∏', '∂', '∇',
    ],
  },
  {
    label: 'Arrows',
    symbols: [
      '→', '←', '↑', '↓', '↔', '⇒', '⇐', '⇔',
      '↗', '↘', '⇌', '⇋', '⟶', '↦', '∴', '∵',
    ],
  },
  {
    label: 'Greek',
    symbols: [
      'α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ',
      'π', 'ρ', 'σ', 'τ', 'φ', 'ω', 'Δ', 'Ω',
    ],
  },
  {
    label: 'Fractions',
    short: 'Frac',
    symbols: [
      '½', '⅓', '⅔', '¼', '¾', '⅕', '⅖', '⅗',
      '⅘', '⅙', '⅚', '⅛', '⅜', '⅝', '⅞', '‰',
    ],
  },
]

/**
 * Inserts `symbol` at the current cursor position of the target
 * input/textarea. Falls back to appending if the element is missing
 * a selection (e.g. an input not yet focused). Works on both
 * controlled and uncontrolled inputs via the native value-setter
 * trick that nudges React's value tracker.
 */
function insertAtCursor(targetId: string, symbol: string): void {
  const el = document.getElementById(targetId) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null
  if (!el) return

  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  const next = before + symbol + after

  // Set the value via the prototype descriptor so React's value
  // tracker registers the change. Without this, controlled inputs
  // would snap back to the React state value on the next render.
  const proto =
    el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) {
    setter.call(el, next)
  } else {
    el.value = next
  }

  // Tell React (or any other onChange listener) that the value
  // changed. The 'input' event is what React's synthetic onChange
  // listens to on text inputs.
  el.dispatchEvent(new Event('input', { bubbles: true }))

  // Move the cursor to just after the inserted symbol.
  requestAnimationFrame(() => {
    el.focus()
    const pos = start + symbol.length
    el.setSelectionRange(pos, pos)
  })
}

interface SymbolToolbarProps {
  targetId: string
  /** Optional label shown to the left of the category pills. */
  label?: string
  /** Compact mode: fewer/shorter category pills. Use inside narrow
   *  cards like the per-sub-part rows on the case-based editor. */
  compact?: boolean
}

export function SymbolToolbar({
  targetId,
  label = 'Insert',
  compact = false,
}: SymbolToolbarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close the popover when the user clicks outside the toolbar.
  // Click-on-symbol won't trigger this because the symbol button
  // is inside the container.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Attach a paste handler to the target input so HTML <sub> / <sup>
  // wrappers from rich-text sources (Word, Google Docs, textbook
  // PDFs, Wikipedia) get rewritten to unicode subscripts /
  // superscripts before the text lands in the field. Without this,
  // pasting "H<sub>2</sub>O" into a <textarea> would arrive as
  // "H2O" because the browser strips the formatting tags but the
  // underlying "2" is still a plain digit.
  useEffect(() => {
    const el = document.getElementById(targetId) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null
    if (!el) return

    // Typed as Event + cast inside so we satisfy the generic
    // EventListener signature on a HTMLInputElement | HTMLTextAreaElement
    // union without TS narrowing to the strict ClipboardEvent overload.
    function handlePaste(e: Event) {
      const cd = (e as ClipboardEvent).clipboardData
      if (!cd) return
      const html = cd.getData('text/html')
      // No HTML payload (e.g. pasting from another <textarea> or
      // a plain-text editor) - let the browser handle paste normally
      // so the plain-text path stays untouched.
      if (!html) return
      const converted = htmlClipboardToUnicodeText(html)
      if (converted === null) return
      const plainFallback = cd.getData('text/plain') ?? ''
      // If the conversion didn't change anything (no sub/sup tags
      // were involved), defer to the browser's default paste - it
      // already handles plain-text insertion perfectly and we don't
      // need to fight with it. We only intercept when our rewrite
      // would meaningfully differ from the plain-text fallback.
      if (converted === plainFallback) return
      e.preventDefault()
      insertAtCursor(targetId, converted)
    }

    el.addEventListener('paste', handlePaste)
    return () => el.removeEventListener('paste', handlePaste)
  }, [targetId])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex flex-wrap items-center gap-1 rounded-md border border-[#e8ecf2] bg-[#f8fafc] px-1.5 py-1"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] px-1">
        {label}
      </span>
      {GROUPS.map((group) => {
        const isOpen = openGroup === group.label
        return (
          <div key={group.label} className="relative">
            <button
              type="button"
              onClick={() => setOpenGroup(isOpen ? null : group.label)}
              aria-expanded={isOpen}
              aria-controls={`symbols-${group.label}`}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                isOpen
                  ? 'bg-[#3A8C39] text-white'
                  : 'text-[#475569] hover:bg-[#F0FDF4] hover:text-[#3A8C39]'
              }`}
            >
              {compact && group.short ? group.short : group.label}
            </button>
            {isOpen && (
              <div
                id={`symbols-${group.label}`}
                role="menu"
                className="absolute left-0 top-full z-20 mt-1 grid grid-cols-8 gap-0.5 rounded-md border border-[#e8ecf2] bg-white p-1.5 shadow-md"
                style={{ minWidth: '240px' }}
              >
                {group.symbols.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    role="menuitem"
                    onClick={() => insertAtCursor(targetId, symbol)}
                    title={`Insert ${symbol}`}
                    className="flex h-7 w-7 items-center justify-center rounded text-sm text-[#1B1F23] hover:bg-[#DCFCE7] hover:text-[#3A8C39] transition-colors"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
