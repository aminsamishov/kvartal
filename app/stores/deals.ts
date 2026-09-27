import * as repo from '~/repositories/deals'
import { uid } from '~/repositories/api'
import type { Contract, DealType, Payment, ScheduleItem } from '~/types/models'
import { TODAY } from '~/data/seed'
import { useUnitsStore } from './units'
import { useSalesStore } from './sales'
import { useMiscStore } from './misc'

export interface ContractBalance {
  price: number
  paid: number
  remaining: number
  overdueDays: number
  overdueAmount: number
  nextDue?: ScheduleItem
}

export const useDealsStore = defineStore('deals', {
  state: () => ({
    contracts: [] as Contract[],
    scheduleItems: [] as ScheduleItem[],
    payments: [] as Payment[],
    loaded: false,
    loading: false,
  }),
  getters: {
    contract: (s) => (id: string) => s.contracts.find((c) => c.id === id),
    scheduleFor: (s) => (contractId: string) => s.scheduleItems.filter((i) => i.contractId === contractId).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    paymentsFor: (s) => (contractId: string) => s.payments.filter((p) => p.contractId === contractId).sort((a, b) => b.date.localeCompare(a.date)),
    pendingPayments: (s) => s.payments.filter((p) => p.status === 'pending'),
    contractsForLead: (s) => (leadId: string) => s.contracts.filter((c) => c.leadId === leadId),
    contractsForClient: (s) => (clientId: string) => s.contracts.filter((c) => c.clientId === clientId),
    balance() {
      return (contractId: string): ContractBalance => {
        const items = this.scheduleFor(contractId)
        const contract = this.contract(contractId)
        const price = contract?.price ?? 0
        const paid = items.reduce((sum: number, i: ScheduleItem) => sum + i.paid, 0)
        const remaining = Math.max(0, price - paid)
        const overdue = items.filter((i) => new Date(i.dueDate) < TODAY && i.paid < i.amount)
        const overdueAmount = overdue.reduce((sum, i) => sum + (i.amount - i.paid), 0)
        const overdueDays = overdue.length ? Math.max(...overdue.map((i) => Math.round((TODAY.getTime() - new Date(i.dueDate).getTime()) / 86400000))) : 0
        const nextDue = items.find((i) => i.paid < i.amount)
        return { price, paid, remaining, overdueDays, overdueAmount, nextDue }
      }
    },
    paymentBoardBucket() {
      return (contractId: string): 'soon' | 'today' | 'd1_7' | 'd8_30' | 'd30_plus' | 'ok' => {
        const b = this.balance(contractId)
        if (!b.nextDue) return 'ok'
        const days = Math.round((new Date(b.nextDue.dueDate).getTime() - TODAY.getTime()) / 86400000)
        if (days > 3) return 'soon'
        if (days >= 0) return 'today'
        if (days >= -7) return 'd1_7'
        if (days >= -30) return 'd8_30'
        return 'd30_plus'
      }
    },
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      const [contracts, scheduleItems, payments] = await Promise.all([repo.fetchContracts(), repo.fetchScheduleItems(), repo.fetchPayments()])
      this.contracts = contracts
      this.scheduleItems = scheduleItems
      this.payments = payments
      this.loaded = true
      this.loading = false
    },
    async createContract(input: {
      projectId: string; clientId: string; unitIds: string[]; dealType: DealType
      price: number; discount: number; currency: 'USD' | 'KGS'; months: number; downPct: number
      route: 'company' | 'notary' | 'state_registry'; needsApproval: boolean; leadId?: string
    }) {
      const now = new Date()
      const contract: Contract = {
        id: uid('ct'), number: `Д-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
        projectId: input.projectId, clientId: input.clientId, unitIds: input.unitIds, dealType: input.dealType,
        status: input.needsApproval ? 'pending_approval' : 'active', currency: input.currency, price: input.price,
        discount: input.discount, signedAt: now.toISOString(), createdAt: now.toISOString(), route: input.route,
        leadId: input.leadId,
      }
      const isFull = input.months <= 1
      const down = Math.round(input.price * (isFull ? 1 : input.downPct / 100))
      const rest = input.price - down
      const monthly = isFull ? 0 : Math.round(rest / Math.max(1, input.months - 1))
      const items: ScheduleItem[] = [{ id: uid('sch'), contractId: contract.id, dueDate: now.toISOString(), amount: down, paid: 0, version: 1 }]
      for (let m = 1; m < input.months; m++) {
        const due = new Date(new Date(now).setMonth(now.getMonth() + m))
        const amount = m === input.months - 1 ? rest - monthly * (input.months - 2) : monthly
        items.push({ id: uid('sch'), contractId: contract.id, dueDate: due.toISOString(), amount, paid: 0, version: 1 })
      }
      await repo.createContract(contract, items)
      this.contracts.unshift(contract)
      this.scheduleItems.push(...items)

      const unitsStore = useUnitsStore()
      for (const unitId of input.unitIds) {
        const u = unitsStore.unit(unitId)
        if (u) {
          u.status = isFull ? 'sold' : 'installment'
          u.contractId = contract.id
        }
      }
      const salesStore = useSalesStore()
      const activeRes = input.unitIds.map((id) => salesStore.reservationForUnit(id)).find(Boolean)
      if (activeRes) activeRes.status = 'converted'
      // заявка доходит до «Сделки» сама — иначе менеджер двигает карточку руками
      // и воронка расходится с фактом
      if (input.leadId) {
        const lead = salesStore.lead(input.leadId)
        if (lead && lead.stage !== 'deal') salesStore.moveLead(input.leadId, 'deal', 'Система')
      }

      // Автоматизация: договор подписан — график создан, первый платёж уже
      // ждёт кассира. Уведомление закрывает разрыв между продажей и финансами.
      useMiscStore().notify({
        key: `auto-contract-${contract.id}`,
        text: `Договор ${contract.number}: создан график на ${items.length} платеж(ей), первый — ${new Date(items[0]!.dueDate).toLocaleDateString('ru-RU')}`,
        kind: contract.status === 'pending_approval' ? 'approval' : 'system',
      })

      return contract
    },
    async confirmPayment(paymentId: string) {
      const p = this.payments.find((x) => x.id === paymentId)
      if (!p) return
      p.status = 'confirmed'
      p.receiptNumber = p.receiptNumber ?? `ПКО-${Math.floor(1000 + Math.random() * 8000)}`
      await repo.confirmPayment(paymentId)
      let remaining = p.amount
      for (const item of this.scheduleFor(p.contractId)) {
        if (remaining <= 0) break
        const room = item.amount - item.paid
        if (room <= 0) continue
        const take = Math.min(room, remaining)
        item.paid += take
        remaining -= take
      }
    },
    async rejectPayment(paymentId: string) {
      const p = this.payments.find((x) => x.id === paymentId)
      if (!p) return
      p.status = 'rejected'
      await repo.rejectPayment(paymentId)
    },
    async registerPayment(contractId: string, amount: number, kind: Payment['kind']) {
      const payment: Payment = { id: uid('pay'), contractId, date: new Date().toISOString(), amount, currency: 'USD', kind, status: 'pending' }
      await repo.registerPayment(payment)
      this.payments.unshift(payment)
      return payment
    },
  },
})
