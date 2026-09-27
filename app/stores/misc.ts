import * as repo from '~/repositories/misc'
import type { AuditEntry, NotificationItem } from '~/types/models'
import { uid } from '~/repositories/api'

export interface GeneratedDocument {
  id: string
  templateName: string
  process: string
  contractNumber?: string
  clientName?: string
  createdAt: string
  createdBy: string
}

export const useMiscStore = defineStore('misc', {
  state: () => ({
    audit: [] as AuditEntry[],
    notifications: [] as NotificationItem[],
    generatedDocs: [] as GeneratedDocument[],
    loaded: false,
    loading: false,
  }),
  getters: {
    unreadCount: (s) => s.notifications.filter((n) => !n.read).length,
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      const [audit, notifications] = await Promise.all([repo.fetchAudit(), repo.fetchNotifications()])
      this.audit = audit
      this.notifications = notifications
      this.generatedDocs = [
        { id: 'doc-seed-1', templateName: 'Договор купли-продажи в рассрочку', process: 'Договор', contractNumber: 'Д-2026-1042', clientName: 'Осмонова Айгуль', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), createdBy: 'Айгуль Осмонова' },
        { id: 'doc-seed-2', templateName: 'Приходный кассовый ордер (ПКО)', process: 'Платёж', contractNumber: 'Д-2026-1042', clientName: 'Осмонова Айгуль', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), createdBy: 'Елена Волкова' },
        { id: 'doc-seed-3', templateName: 'Коммерческое предложение', process: 'КП', clientName: 'Токтогулов Данияр', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), createdBy: 'Данияр Токтогулов' },
        { id: 'doc-seed-4', templateName: 'Акт приёма-передачи', process: 'Ключи', contractNumber: 'Д-2025-0871', clientName: 'Молдалиева Гульнара', createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), createdBy: 'Виктория Сыдыкова' },
      ]
      this.loaded = true
      this.loading = false
    },
    log(module: string, text: string, author: string) {
      const entry: AuditEntry = { id: `a-${Date.now()}`, module, text, author, at: new Date().toISOString() }
      this.audit.unshift(entry)
    },
    generateDocument(input: Omit<GeneratedDocument, 'id' | 'createdAt'>) {
      const doc: GeneratedDocument = { ...input, id: uid('doc'), createdAt: new Date().toISOString() }
      this.generatedDocs.unshift(doc)
      this.log('Документы', `Сформирован «${doc.templateName}»${doc.contractNumber ? ` по договору ${doc.contractNumber}` : ''}`, doc.createdBy)
      return doc
    },
    markRead(id: string) {
      const n = this.notifications.find((x) => x.id === id)
      if (n) n.read = true
      repo.markNotificationRead(id)
    },
    markAllRead() {
      this.notifications.forEach((n) => (n.read = true))
    },
  },
})
