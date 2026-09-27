import * as repo from '~/repositories/pricing'
import { uid } from '~/repositories/api'
import type { PriceDraft } from '~/types/models'
import { useUnitsStore } from './units'

export const usePricingStore = defineStore('pricing', {
  state: () => ({
    drafts: [] as PriceDraft[],
    loaded: false,
    loading: false,
  }),
  getters: {
    draft: (s) => (id: string) => s.drafts.find((d) => d.id === id),
    draftsByProject: (s) => (projectId: string) => s.drafts.filter((d) => d.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activeDraft: (s) => (projectId: string) => s.drafts.find((d) => d.projectId === projectId && d.status === 'draft'),
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      this.drafts = await repo.fetchPriceDrafts()
      this.loaded = true
      this.loading = false
    },
    createDraft(projectId: string, title: string, createdBy: string) {
      const draft: PriceDraft = { id: uid('pd'), projectId, status: 'draft', title, createdBy, createdAt: new Date().toISOString(), items: [] }
      this.drafts.unshift(draft)
      repo.saveDraft(draft)
      return draft
    },
    setItemPrice(draftId: string, unitId: string, oldPrice: number, newPrice: number) {
      const draft = this.draft(draftId)
      if (!draft) return
      const existing = draft.items.find((i) => i.unitId === unitId)
      if (existing) existing.newPrice = newPrice
      else draft.items.push({ unitId, oldPrice, newPrice })
      repo.saveDraft(draft)
    },
    removeItem(draftId: string, unitId: string) {
      const draft = this.draft(draftId)
      if (!draft) return
      draft.items = draft.items.filter((i) => i.unitId !== unitId)
    },
    async publish(draftId: string) {
      const draft = this.draft(draftId)
      if (!draft) return
      await repo.publishDraft(draftId)
      draft.status = 'published'
      draft.publishedAt = new Date().toISOString()
      const unitsStore = useUnitsStore()
      unitsStore.applyPriceItems(draft.items)
    },
  },
})
