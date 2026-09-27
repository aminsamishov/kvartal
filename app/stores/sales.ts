import * as repo from '~/repositories/sales'
import { uid } from '~/repositories/api'
import type { Client, ClientDocument, CommKind, CommOutcome, DocKind, Lead, LeadComm, LeadEvent, LeadInterest, LeadNote, LeadPriority, LeadStage, LeadTask, LeadTaskKind, Reservation, ReservationKind } from '~/types/models'
import { TODAY } from '~/data/seed'
import { useUnitsStore } from './units'
import { useSettingsStore } from './settings'

const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'Новая', contacted: 'Связались', visit: 'Показ', reserved: 'Бронь', deal: 'Сделка', lost: 'Отказ',
}

export const useSalesStore = defineStore('sales', {
  state: () => ({
    clients: [] as Client[],
    leads: [] as Lead[],
    reservations: [] as Reservation[],
    documents: [] as ClientDocument[],
    loaded: false,
    loading: false,
  }),
  getters: {
    client: (s) => (id: string) => s.clients.find((c) => c.id === id),
    lead: (s) => (id: string) => s.leads.find((l) => l.id === id),
    leadsByStage: (s) => (stage: string) => s.leads.filter((l) => l.stage === stage),
    reservationForUnit: (s) => (unitId: string) => s.reservations.find((r) => r.unitId === unitId && r.status === 'active'),
    activeReservations: (s) => s.reservations.filter((r) => r.status === 'active'),

    /** Ближайшая невыполненная задача заявки — по ней карточка красится. */
    openTask: () => (lead: Lead): LeadTask | undefined =>
      [...lead.tasks].filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0],

    /**
     * Состояние задачи относительно «сегодня»: просрочена / сегодня / впереди /
     * задачи нет. В amo и Битриксе это главный цветовой сигнал на доске —
     * карточка без задачи такая же проблема, как карточка с просрочкой.
     */
    taskState() {
      return (lead: Lead): 'overdue' | 'today' | 'planned' | 'none' => {
        if (lead.stage === 'deal' || lead.stage === 'lost') return 'none'
        const task = this.openTask(lead)
        if (!task) return 'none'
        const due = new Date(task.dueAt)
        const days = Math.floor((due.getTime() - TODAY.getTime()) / 86400000)
        if (days < 0) return 'overdue'
        if (days === 0) return 'today'
        return 'planned'
      }
    },

    /** Сводка по этапу для шапки колонки: сколько заявок и на какую сумму. */
    stageSummary: (s) => (stage: LeadStage) => {
      const list = s.leads.filter((l) => l.stage === stage)
      return { count: list.length, budget: list.reduce((sum, l) => sum + (l.budget || 0), 0) }
    },

    /** Сколько дней заявка стоит на текущем этапе. */
    daysInStage: () => (lead: Lead) =>
      Math.max(0, Math.floor((TODAY.getTime() - new Date(lead.stageSince).getTime()) / 86400000)),

    allTags: (s) => [...new Set(s.leads.flatMap((l) => l.tags))].sort(),

    /* ---- связи: без них карточка заявки не может показать бронь и сделку ---- */
    reservationsForLead: (s) => (leadId: string) =>
      s.reservations.filter((r) => r.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activeReservationForLead: (s) => (leadId: string) =>
      s.reservations.find((r) => r.leadId === leadId && r.status === 'active'),
    leadsForClient: (s) => (clientId: string) =>
      s.leads.filter((l) => l.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    reservationsForClient: (s) => (clientId: string) => s.reservations.filter((r) => r.clientId === clientId),
    documentsForLead: (s) => (leadId: string) =>
      s.documents.filter((d) => d.leadId === leadId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    documentsForClient: (s) => (clientId: string) =>
      s.documents.filter((d) => d.clientId === clientId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    /** Кто ещё интересовался этим помещением — для блока «Связи». */
    leadsInterestedInUnit: (s) => (unitId: string) => s.leads.filter((l) => l.interestedUnitIds.includes(unitId)),
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      const [clients, leads, reservations, documents] = await Promise.all([
        repo.fetchClients(), repo.fetchLeads(), repo.fetchReservations(), repo.fetchDocuments(),
      ])
      this.clients = clients
      this.leads = leads
      this.reservations = reservations
      this.documents = documents
      // просроченные брони снимаем при входе: иначе фонд блокируется молча
      this.expireReservations()
      this.loaded = true
      this.loading = false
    },
    async addClient(data: Omit<Client, 'id' | 'createdAt'>) {
      const client: Client = { ...data, id: uid('c'), createdAt: new Date().toISOString() }
      await repo.createClient(client)
      this.clients.unshift(client)
      return client
    },
    setLeadStage(leadId: string, stage: LeadStage) {
      const lead = this.leads.find((l) => l.id === leadId)
      if (lead) lead.stage = stage
    },


    /* --------------------------- интерес и подбор --------------------------- */

    setLeadInterest(leadId: string, patch: Partial<LeadInterest>, author?: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      lead.interest = { ...lead.interest, ...patch }
      // budget остаётся рабочей суммой воронки — держим его в синхроне с вилкой
      if (patch.budgetMax !== undefined) lead.budget = patch.budgetMax || lead.budget
      if (author) this.logLead(leadId, 'field', 'Обновлён запрос клиента', author)
    },

    /* ------------------------------ коммуникации ---------------------------- */

    addComm(leadId: string, data: { kind: CommKind; outcome?: CommOutcome; durationSec?: number; note?: string }, author: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      const comm: LeadComm = { id: uid('comm'), at: new Date().toISOString(), author, ...data }
      lead.comms.unshift(comm)
      lead.lastContactAt = comm.at
      return comm
    },

    /* ------------------------------- документы ------------------------------ */

    addDocument(data: Omit<ClientDocument, 'id' | 'uploadedAt' | 'signed'>) {
      const doc: ClientDocument = { ...data, id: uid('cdoc'), uploadedAt: new Date().toISOString(), signed: false }
      this.documents.unshift(doc)
      return doc
    },
    toggleDocumentSigned(docId: string) {
      const d = this.documents.find((x) => x.id === docId)
      if (!d) return
      d.signed = !d.signed
      d.signedAt = d.signed ? new Date().toISOString() : undefined
    },
    setDocumentKind(docId: string, kind: DocKind) {
      const d = this.documents.find((x) => x.id === docId)
      if (d) d.kind = kind
    },
    removeDocument(docId: string) {
      this.documents = this.documents.filter((d) => d.id !== docId)
    },

    /* --------------------------- бронь из заявки ---------------------------- */

    /**
     * Бронь, созданная из карточки заявки. В отличие от reserveUnit проставляет
     * leadId и двигает заявку на этап «Бронь» — без этой связи невозможно
     * посчитать конверсию «бронь → договор» и источник продажи.
     */
    async reserveFromLead(leadId: string, unitId: string, kind: ReservationKind, deposit: number, author: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      const reservation = await this.reserveUnit(unitId, lead.clientId, kind, deposit, author, leadId)
      if (!lead.interestedUnitIds.includes(unitId)) lead.interestedUnitIds.push(unitId)
      if (lead.stage !== 'reserved' && lead.stage !== 'deal') this.moveLead(leadId, 'reserved', author)
      return reservation
    },

    async extendReservation(reservationId: string, days: number, author: string) {
      const r = this.reservations.find((x) => x.id === reservationId)
      if (!r) return
      r.expiresAt = new Date(new Date(r.expiresAt).getTime() + days * 86400000).toISOString()
      if (r.leadId) this.logLead(r.leadId, 'field', `Бронь продлена на ${days} дн.`, author)
    },

    /**
     * Снятие просроченных броней. Пока этого не было, забронированная квартира
     * висела вечно и очередь не двигалась — фонд блокировался молча.
     * Вызывается при загрузке приложения и после действий с бронями.
     */
    expireReservations(now = new Date()) {
      const expired = this.reservations.filter((r) => r.status === 'active' && new Date(r.expiresAt) < now)
      const unitsStore = useUnitsStore()
      for (const r of expired) {
        r.status = 'expired'
        const offered = unitsStore.offerToNextInQueue(r.unitId)
        if (!offered) {
          unitsStore.setStatus(r.unitId, 'free')
        } else if (useSettingsStore().reservationSettings.autoQueueTransfer && offered.clientId) {
          // Очередь имеет смысл только если она двигается сама: следующему
          // интересанту сразу оформляется короткая бронь без задатка, иначе
          // объект просто «висит забронированным» на неизвестного человека.
          const lead = this.leads.find((l) => l.clientId === offered.clientId
            && l.stage !== 'lost' && l.stage !== 'deal')
          const nowIso = now.toISOString()
          const handoff: Reservation = {
            id: uid('res'), unitId: r.unitId, clientId: offered.clientId, leadId: lead?.id,
            kind: 'no_deposit', deposit: 0, createdAt: nowIso,
            expiresAt: new Date(now.getTime() + 86400000).toISOString(),
            status: 'active', createdBy: 'Автоматизация',
          }
          this.reservations.push(handoff)
          void repo.createReservation(handoff)
          const unit = unitsStore.unit(r.unitId)
          if (unit) unit.reservationId = handoff.id
          if (lead) this.logLead(lead.id, 'field', `Освободившаяся квартира предложена из очереди${unit ? `: № ${unit.number}` : ''}`, 'Автоматизация')
        }
        if (r.leadId) {
          this.logLead(r.leadId, 'field', offered
            ? 'Бронь истекла — объект ушёл следующему в очереди'
            : 'Бронь истекла — объект освобождён', 'Система')
        }
      }
      return expired.length
    },

    /* ------------------------------ заявки (CRM) ----------------------------- */

    logLead(leadId: string, kind: LeadEvent['kind'], text: string, author: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      lead.history.push({ id: uid('ev'), kind, text, author, at: new Date().toISOString() })
    },

    /**
     * Перевод заявки на другой этап. Кроме самого этапа двигаем stageSince —
     * иначе счётчик «висит N дней» показывал бы возраст заявки, а не простой
     * на текущем этапе, ради которого его и смотрят.
     */
    moveLead(leadId: string, stage: LeadStage, author: string, opts: { lostReason?: string } = {}) {
      const lead = this.lead(leadId)
      if (!lead || lead.stage === stage) return
      const from = lead.stage
      lead.stage = stage
      lead.stageSince = new Date().toISOString()
      if (stage === 'lost') {
        lead.lostReason = opts.lostReason || 'Не указана'
        lead.lostAt = lead.stageSince
        this.logLead(leadId, 'lost', `Отказ: ${lead.lostReason}`, author)
      } else {
        // возврат из отказа обратно в работу должен снимать причину,
        // иначе она навсегда остаётся висеть на карточке
        delete lead.lostReason
        delete lead.lostAt
        this.logLead(leadId, stage === 'deal' ? 'won' : 'stage', `Этап: ${LEAD_STAGE_LABELS[from]} → ${LEAD_STAGE_LABELS[stage]}`, author)
      }
      return { from, to: stage }
    },

    assignLead(leadId: string, userId: string, userName: string, author: string) {
      const lead = this.lead(leadId)
      if (!lead || lead.assignedTo === userId) return
      lead.assignedTo = userId
      this.logLead(leadId, 'assign', `Ответственный: ${userName}`, author)
    },

    patchLead(leadId: string, patch: Partial<Lead>, author?: string, note?: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      Object.assign(lead, patch)
      if (author && note) this.logLead(leadId, 'field', note, author)
    },

    setLeadPriority(leadId: string, priority: LeadPriority) {
      const lead = this.lead(leadId)
      if (lead) lead.priority = priority
    },

    toggleLeadTag(leadId: string, tag: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      lead.tags = lead.tags.includes(tag) ? lead.tags.filter((t) => t !== tag) : [...lead.tags, tag]
    },

    addLeadNote(leadId: string, text: string, author: string) {
      const lead = this.lead(leadId)
      if (!lead || !text.trim()) return
      const note: LeadNote = { id: uid('note'), text: text.trim(), author, at: new Date().toISOString() }
      lead.notes.unshift(note)
      lead.lastContactAt = note.at
      this.logLead(leadId, 'note', 'Добавлена заметка', author)
      return note
    },

    addLeadTask(leadId: string, data: { kind: LeadTaskKind; title: string; dueAt: string; assignedTo: string }, author: string) {
      const lead = this.lead(leadId)
      if (!lead || !data.title.trim()) return
      const task: LeadTask = { id: uid('task'), done: false, ...data, title: data.title.trim() }
      lead.tasks.push(task)
      this.syncNextAction(lead)
      this.logLead(leadId, 'task', `Поставлена задача: ${task.title}`, author)
      return task
    },

    toggleLeadTask(leadId: string, taskId: string, author: string) {
      const lead = this.lead(leadId)
      const task = lead?.tasks.find((t) => t.id === taskId)
      if (!lead || !task) return
      task.done = !task.done
      task.doneAt = task.done ? new Date().toISOString() : undefined
      if (task.done) {
        lead.lastContactAt = task.doneAt
        this.logLead(leadId, 'task_done', `Задача выполнена: ${task.title}`, author)
      }
      this.syncNextAction(lead)
    },

    updateLeadTask(leadId: string, taskId: string, patch: Partial<LeadTask>, author: string) {
      const lead = this.lead(leadId)
      const task = lead?.tasks.find((t) => t.id === taskId)
      if (!lead || !task) return
      Object.assign(task, patch)
      this.syncNextAction(lead)
      this.logLead(leadId, 'task', `Задача изменена: ${task.title}`, author)
    },

    /** Перенос срока — сохраняем прежнюю дату, чтобы переносы были видны. */
    rescheduleLeadTask(leadId: string, taskId: string, days: number, author: string) {
      const lead = this.lead(leadId)
      const task = lead?.tasks.find((t) => t.id === taskId)
      if (!lead || !task) return
      task.rescheduledFrom = task.dueAt
      task.dueAt = new Date(new Date(task.dueAt).getTime() + days * 86400000).toISOString()
      this.syncNextAction(lead)
      this.logLead(leadId, 'task', `Срок перенесён на ${days} дн.: ${task.title}`, author)
    },

    /** Выполнение с итогом — итог попадает в ленту истории. */
    completeLeadTask(leadId: string, taskId: string, result: string, author: string) {
      const lead = this.lead(leadId)
      const task = lead?.tasks.find((t) => t.id === taskId)
      if (!lead || !task) return
      task.done = true
      task.doneAt = new Date().toISOString()
      task.result = result || undefined
      lead.lastContactAt = task.doneAt
      this.syncNextAction(lead)
      this.logLead(leadId, 'task_done', `Задача выполнена: ${task.title}${result ? ` — ${result}` : ''}`, author)

      // Автоматизация: после показа клиенту перезванивают на следующий день.
      // Вручную этот шаг ставят через раз — и именно здесь сделки зависают.
      if (task.kind === 'visit' && useSettingsStore().automations.visitFollowUp
        && lead.stage !== 'deal' && lead.stage !== 'lost') {
        this.addLeadTask(leadId, {
          kind: 'call',
          title: 'Узнать впечатления после показа',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          assignedTo: task.assignedTo || lead.assignedTo,
        }, 'Автоматизация')
      }
    },

    removeLeadTask(leadId: string, taskId: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      lead.tasks = lead.tasks.filter((t) => t.id !== taskId)
      this.syncNextAction(lead)
    },

    /** nextAction/nextAt читают дашборд и другие виджеты — держим в синхроне. */
    syncNextAction(lead: Lead) {
      const next = [...lead.tasks].filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
      lead.nextAction = next?.title
      lead.nextAt = next?.dueAt
    },

    toggleLeadUnit(leadId: string, unitId: string) {
      const lead = this.lead(leadId)
      if (!lead) return
      lead.interestedUnitIds = lead.interestedUnitIds.includes(unitId)
        ? lead.interestedUnitIds.filter((id) => id !== unitId)
        : [...lead.interestedUnitIds, unitId]
    },

    createLead(data: {
      clientId: string; channel: string; source: string; assignedTo: string
      budget?: number; priority?: LeadPriority; tags?: string[]; interestedUnitIds?: string[]
    }, author: string) {
      const now = new Date().toISOString()
      const lead: Lead = {
        id: uid('lead'), clientId: data.clientId, stage: 'new',
        channel: data.channel, source: data.source, createdAt: now,
        assignedTo: data.assignedTo, interestedUnitIds: data.interestedUnitIds ?? [],
        budget: data.budget ?? 0, priority: data.priority ?? 'normal', tags: data.tags ?? [],
        stageSince: now, tasks: [], notes: [], comms: [],
        interest: { projectIds: [], buildingIds: [], budgetMax: data.budget || undefined, paymentMethod: 'installment' },
        history: [{ id: uid('ev'), kind: 'created', text: `Заявка создана из источника «${data.source}»`, author, at: now }],
      }
      this.leads.unshift(lead)

      // Автоматизация: заявка без задачи — главная причина, по которой клиенты
      // теряются между этапами. Первый шаг ставим сразу, откуда бы заявка ни
      // пришла: с формы менеджера, из мастера сделок или с сайта.
      if (useSettingsStore().automations.leadTask) {
        this.addLeadTask(lead.id, {
          kind: 'call',
          title: 'Первый звонок клиенту',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          assignedTo: data.assignedTo,
        }, 'Автоматизация')
      }

      return lead
    },

    removeLead(leadId: string) {
      this.leads = this.leads.filter((l) => l.id !== leadId)
    },

    async reserveUnit(unitId: string, clientId: string, kind: ReservationKind, deposit: number, createdBy: string, leadId?: string) {
      const days = kind === 'no_deposit' ? 1 : kind === 'confirmed' ? 3 : 30
      const now = new Date()
      const reservation: Reservation = {
        id: uid('res'), unitId, clientId, kind, deposit, leadId,
        createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + days * 86400000).toISOString(),
        status: 'active', createdBy,
      }
      await repo.createReservation(reservation)
      this.reservations.push(reservation)
      const unitsStore = useUnitsStore()
      unitsStore.setStatus(unitId, 'reserved')
      const u = unitsStore.unit(unitId)
      if (u) u.reservationId = reservation.id
      return reservation
    },
    async cancelReservation(id: string, releaseUnit = true) {
      const r = this.reservations.find((x) => x.id === id)
      if (!r) return
      r.status = 'cancelled'
      await repo.cancelReservation(id)
      const unitsStore = useUnitsStore()
      if (releaseUnit) {
        const offered = unitsStore.offerToNextInQueue(r.unitId)
        if (!offered) unitsStore.setStatus(r.unitId, 'free')
      }
    },
  },
})
