import { PRICE_DRAFTS } from '~/data/seed'
import type { PriceDraft } from '~/types/models'
import { clone, delay } from './api'

export function fetchPriceDrafts(): Promise<PriceDraft[]> {
  return delay(clone(PRICE_DRAFTS), 220)
}

export function saveDraft(draft: PriceDraft): Promise<PriceDraft> {
  return delay(draft, 200)
}

export function publishDraft(draftId: string): Promise<void> {
  return delay(undefined, 320)
}
