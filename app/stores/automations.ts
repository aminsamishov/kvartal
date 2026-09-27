import type {
  AutomationAction, AutomationContext, AutomationRule, AutomationRun, AutomationTriggerKind,
} from '~/types/automation'
import { fillTemplate, matchesConditions } from '~/utils/automation'
import { builtinRules } from '~/data/automations'
import { fmtDate, fmtDateTime, money } from '~/utils/format'

/**
 * Движок автоматизаций. Правила живут здесь же, где исполняются: экран
 * конструктора правит те самые объекты, по которым система работает, — иначе
 * «включено» в настройках и поведение системы разъезжаются.
 *
 * Событийные триггеры вызываются из сторов в момент действия (`fire`),
 * временные — при входе в систему (`runTimed`).
 */
/**
 * Сколько раз одно временное правило может сработать за один прогон. Двадцать
 * одинаковых строк в колокольчике никто не читает — выше порога система даёт
 * одну сводку и отправляет разбираться в раздел.
 */
const MAX_PER_RUN = 5

export const useAutomationsStore = defineStore('automations', {
  state: () => ({
    rules: builtinRules() as AutomationRule[],
    /** журнал срабатываний: что, когда и по какому объекту */
    runs: [] as AutomationRun[],
    /**
     * Уже отработанные временные события. Правило по времени проверяется при
     * каждом входе, а задача должна появиться один раз.
     */
    fired: [] as string[],
  }),
  getters: {
    rule: (s) => (id: string) => s.rules.find((r) => r.id === id),
    byTrigger: (s) => (trigger: AutomationTriggerKind) => s.rules.filter((r) => r.trigger === trigger),
    activeCount: (s) => s.rules.filter((r) => r.enabled).length,
    totalRuns: (s) => s.rules.reduce((n, r) => n + r.runs, 0),
  },
  actions: {
    /* --------------------------------- CRUD -------------------------------- */

    saveRule(rule: AutomationRule) {
      const i = this.rules.findIndex((r) => r.id === rule.id)
      if (i >= 0) this.rules[i] = { ...rule }
      else this.rules.push({ ...rule })
    },
    removeRule(id: string) {
      const rule = this.rule(id)
      if (!rule || rule.builtin) return false
      this.rules = this.rules.filter((r) => r.id !== id)
      return true
    },
    toggleRule(id: string) {
      const rule = this.rule(id)
      if (rule) rule.enabled = !rule.enabled
    },
    duplicateRule(id: string) {
      const rule = this.rule(id)
      if (!rule) return null
      const copy: AutomationRule = {
        ...JSON.parse(JSON.stringify(rule)),
        id: `rule-${Date.now().toString(36)}`,
        name: `${rule.name} (копия)`,
        builtin: false, runs: 0, lastRunAt: undefined,
      }
      this.rules.push(copy)
      return copy
    },

    /* ------------------------------ исполнение ----------------------------- */

    /** Событийный триггер: вызывается из сторов в момент действия. */
    fire(trigger: AutomationTriggerKind, ctx: AutomationContext) {
      let fired = 0
      for (const rule of this.rules) {
        if (!rule.enabled || rule.trigger !== trigger) continue
        fired += this.fireRule(rule, ctx)
      }
      return fired
    },

    /** Одно действие правила. Возвращает строку для журнала. */
    runAction(action: AutomationAction, ctx: AutomationContext): string | null {
      const sales = useSalesStore()
      const units = useUnitsStore()
      const misc = useMiscStore()
      const settings = useSettingsStore()

      const text = fillTemplate(action.text ?? '', ctx.vars)

      switch (action.kind) {
        case 'notify': {
          const prefix = action.target && action.target !== 'manager'
            ? `${action.target === 'head' ? 'Руководителю' : action.target === 'director' ? 'Директору' : settings.users.find((u) => u.id === action.target)?.name ?? 'Сотруднику'}: `
            : ''
          const body = text || ctx.subject
          misc.notify({ key: `auto-${action.id}-${ctx.key}`, text: `${prefix}${body}`, kind: 'system' })
          return `уведомление ${action.target === 'head' ? 'руководителю' : action.target === 'director' ? 'директору' : 'менеджеру'}`
        }
        case 'task': {
          if (!ctx.leadId) return null
          const lead = sales.lead(ctx.leadId)
          if (!lead || lead.stage === 'lost' || lead.stage === 'deal') return null
          const task = sales.addLeadTask(ctx.leadId, {
            kind: (action.value ?? 'call') as 'call',
            title: text || 'Связаться с клиентом',
            dueAt: new Date(Date.now() + (action.delayHours ?? 24) * 3600000).toISOString(),
            assignedTo: ctx.assignedTo || lead.assignedTo,
          }, 'Автоматизация')
          return task ? `задача «${task.title}»` : null
        }
        case 'stage': {
          if (!ctx.leadId || !action.value) return null
          const lead = sales.lead(ctx.leadId)
          if (!lead || lead.stage === action.value) return null
          sales.moveLead(ctx.leadId, action.value as typeof lead.stage, 'Автоматизация')
          return `этап → «${action.value}»`
        }
        case 'tag': {
          if (!ctx.leadId || !action.value) return null
          const lead = sales.lead(ctx.leadId)
          if (!lead || lead.tags.includes(action.value)) return null
          sales.toggleLeadTag(ctx.leadId, action.value)
          return `метка «${action.value}»`
        }
        case 'offerQueue': {
          if (!ctx.unitId) return null
          const offered = sales.offerUnitToQueue(ctx.unitId, 'Автоматизация')
          return offered ? `объект предложен очереди — ${offered.name}` : null
        }
        case 'freeUnit': {
          if (!ctx.unitId) return null
          const unit = units.unit(ctx.unitId)
          // очередь уже забрала объект — тогда освобождать нечего
          if (!unit || unit.status !== 'reserved' || sales.reservationForUnit(ctx.unitId)) return null
          units.setStatus(ctx.unitId, 'free', 'Автоматизация')
          delete unit.reservationId
          return 'объект вернулся в продажу'
        }
        default:
          return null
      }
    },

    /* --------------------------- временные правила -------------------------- */

    /**
     * Правила, которые зависят от времени, а не от действия менеджера.
     * Проверяются при входе в систему: брони на исходе, истёкшие брони,
     * просрочки и застрявшие заявки.
     */
    runTimed(now = new Date()) {
      const sales = useSalesStore()
      const deals = useDealsStore()
      const units = useUnitsStore()
      const misc = useMiscStore()

      const clientName = (id?: string) => (id ? sales.client(id)?.name ?? 'клиент' : 'клиент')
      const unitLabel = (id: string) => {
        const u = units.unit(id)
        if (!u) return 'объект'
        const b = units.building(u.buildingId)
        return `№ ${u.number}${b ? ` · ${b.name}` : ''}`
      }

      let fired = 0

      /* брони на исходе */
      for (const r of sales.reservations.filter((x) => x.status === 'active')) {
        const hoursLeft = (new Date(r.expiresAt).getTime() - now.getTime()) / 3600000
        if (hoursLeft <= 0) continue
        const unit = units.unit(r.unitId)
        for (const rule of this.rules.filter((x) => x.enabled && x.trigger === 'reservation.expiring')) {
          if (hoursLeft > (rule.offsetHours ?? 24)) continue
          fired += this.fireRule(rule, {
            leadId: r.leadId, unitId: r.unitId, reservationId: r.id, assignedTo: r.createdBy,
            subject: `Бронь ${unitLabel(r.unitId)}`,
            key: `expiring-${r.id}-${Math.ceil(hoursLeft)}h`,
            facts: {
              project: unit?.projectId ?? '', reservationKind: r.kind, deposit: r.deposit, price: unit?.price ?? 0,
            },
            vars: {
              клиент: clientName(r.clientId), объект: unitLabel(r.unitId),
              срок: fmtDateTime(r.expiresAt), сумма: money(r.deposit),
              проект: units.project(unit?.projectId ?? '')?.name ?? '',
            },
          })
        }
      }

      /* истёкшие брони: сама бронь закрывается всегда — это гигиена данных,
         а что делать с объектом, решают правила */
      let expired = 0
      for (const r of sales.reservations.filter((x) => x.status === 'active' && new Date(x.expiresAt) <= now)) {
        r.status = 'expired'
        expired++
        const unit = units.unit(r.unitId)
        if (r.leadId) sales.logLead(r.leadId, 'field', 'Бронь истекла', 'Система')
        const matched = this.rules.filter((x) => x.enabled && x.trigger === 'reservation.expired')
        for (const rule of matched) {
          fired += this.fireRule(rule, {
            leadId: r.leadId, unitId: r.unitId, reservationId: r.id, assignedTo: r.createdBy,
            subject: `Истекла бронь ${unitLabel(r.unitId)}`,
            key: `expired-${r.id}`,
            facts: { project: unit?.projectId ?? '', reservationKind: r.kind, price: unit?.price ?? 0 },
            vars: {
              клиент: clientName(r.clientId), объект: unitLabel(r.unitId),
              срок: fmtDate(r.expiresAt), проект: units.project(unit?.projectId ?? '')?.name ?? '',
            },
          })
        }
      }

      /**
       * Сверка фонда: помещение не может висеть «в брони» без активной брони.
       * Такое состояние возникает от прерванной операции или выключенного
       * правила и молча блокирует продажу — поэтому чиним всегда.
       */
      let repaired = 0
      for (const unit of units.units) {
        if (unit.status !== 'reserved') continue
        if (sales.reservationForUnit(unit.id)) continue
        units.setStatus(unit.id, 'free', 'Система')
        delete unit.reservationId
        repaired++
      }
      if (repaired) misc.log('Автоматизации', `Освобождено помещений без активной брони: ${repaired}`, 'Система')

      /* просрочки: сначала самые тяжёлые — на них и смотрит руководитель */
      let overdue = 0
      const overdueList = deals.contracts
        .filter((c) => c.status === 'active')
        .map((c) => ({ contract: c, balance: deals.balance(c.id) }))
        .filter((x) => x.balance.overdueAmount > 0)
        .sort((a, b) => b.balance.overdueDays - a.balance.overdueDays)
      const overdueRules = this.rules.filter((x) => x.enabled && x.trigger === 'payment.overdue')
      const overdueQuota = new Map(overdueRules.map((r) => [r.id, MAX_PER_RUN]))
      for (const { contract, balance } of overdueList) {
        overdue++
        for (const rule of overdueRules) {
          const minDays = Math.round((rule.offsetHours ?? 24) / 24)
          if (balance.overdueDays < minDays) continue
          const left = overdueQuota.get(rule.id) ?? 0
          if (left <= 0) continue
          overdueQuota.set(rule.id, left - 1)
          fired += this.fireRule(rule, {
            leadId: contract.leadId, contractId: contract.id,
            subject: `Просрочка по договору ${contract.number}`,
            key: `overdue-${contract.id}-${balance.overdueDays}`,
            facts: { project: contract.projectId, overdueDays: balance.overdueDays, amount: balance.overdueAmount },
            vars: {
              клиент: clientName(contract.clientId), договор: contract.number,
              сумма: money(balance.overdueAmount, contract.currency),
              срок: `${balance.overdueDays} дн. просрочки`,
              проект: units.project(contract.projectId)?.name ?? '',
            },
          })
        }
      }

      /* застрявшие заявки: показываем самые запущенные, остальные — сводкой */
      const stalledRules = this.rules.filter((x) => x.enabled && x.trigger === 'lead.stalled')
      const stalledQuota = new Map(stalledRules.map((r) => [r.id, MAX_PER_RUN]))
      const skipped = new Map<string, number>()
      const stalled = sales.leads
        .filter((l) => l.stage !== 'deal' && l.stage !== 'lost')
        .map((l) => ({ lead: l, days: Math.floor((now.getTime() - new Date(l.stageSince).getTime()) / 86400000) }))
        .sort((a, b) => b.days - a.days)
      for (const { lead, days } of stalled) {
        for (const rule of stalledRules) {
          const limit = Math.round((rule.offsetHours ?? 120) / 24)
          if (days < limit) continue
          const left = stalledQuota.get(rule.id) ?? 0
          if (left <= 0) { skipped.set(rule.id, (skipped.get(rule.id) ?? 0) + 1); continue }
          stalledQuota.set(rule.id, left - 1)
          fired += this.fireRule(rule, {
            leadId: lead.id, assignedTo: lead.assignedTo,
            subject: `Заявка ${clientName(lead.clientId)}`,
            key: `stalled-${lead.id}-${days}`,
            facts: { stage: lead.stage, priority: lead.priority, source: lead.source, budget: lead.budget },
            vars: {
              клиент: clientName(lead.clientId), срок: `${days} дн.`,
              менеджер: lead.assignedTo,
            },
          })
        }
      }

      for (const [ruleId, count] of skipped) {
        if (!count) continue
        misc.notify({
          key: `auto-stalled-rest-${ruleId}-${new Date(now).toDateString()}`,
          text: `Без движения ещё ${count} заявок — откройте воронку`,
          kind: 'system',
        })
      }

      return { fired, expired, overdue, repaired }
    },

    /** Прогон конкретного правила: условия уже по контексту, дедуп — по ключу. */
    fireRule(rule: AutomationRule, ctx: AutomationContext) {
      if (!matchesConditions(rule, ctx)) return 0
      const guard = `${rule.id}:${ctx.key}`
      if (this.fired.includes(guard)) return 0
      this.fired.push(guard)

      const effects: string[] = []
      for (const action of rule.actions) {
        const done = this.runAction(action, ctx)
        if (done) effects.push(done)
      }
      if (!effects.length) return 0

      rule.runs += 1
      rule.lastRunAt = new Date().toISOString()
      this.runs.unshift({
        id: `run-${Date.now().toString(36)}-${rule.runs}`,
        ruleId: rule.id, ruleName: rule.name, at: rule.lastRunAt,
        subject: ctx.subject, effects,
      })
      if (this.runs.length > 60) this.runs.length = 60
      return 1
    },
  },
})
