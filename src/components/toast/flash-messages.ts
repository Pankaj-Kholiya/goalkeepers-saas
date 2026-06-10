/**
 * Flash-toast registry. Server actions that `redirect()` (or revalidate) on
 * success have no client context to fire a toast, so they append a `?flash=<key>`
 * to the destination URL. <FlashToaster> reads that key on the next render and
 * fires the matching toast, then strips the param.
 *
 * Keep keys short + stable; they travel in the URL. Add a new entry here, then
 * append `?flash=<key>` in the action's redirect/revalidate target.
 */

import type { ToastType } from './ToastProvider'

export interface FlashMessage {
  type: ToastType
  message: string
}

export const FLASH_MESSAGES: Record<string, FlashMessage> = {
  // Schools (platform admin)
  'school-archived': { type: 'success', message: 'School archived.' },
  'school-restored': { type: 'success', message: 'School restored.' },
  'school-deleted': { type: 'success', message: 'School permanently deleted.' },

  // Question bank
  'question-created': { type: 'success', message: 'Question added to the bank.' },
  'question-updated': { type: 'success', message: 'Question updated.' },

  // Quiz events
  'event-created': { type: 'success', message: 'Draft event created.' },
  'event-published': { type: 'success', message: 'Event published.' },

  // Settings
  'branding-saved': { type: 'success', message: 'Branding saved.' },
}
