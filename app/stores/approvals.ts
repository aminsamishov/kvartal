import * as repo from '~/repositories/approvals'
import { uid } from '~/repositories/api'
import type { ApprovalDecision, ApprovalRole, DiscountRequest, UserRole } from '~/types/models'
import { useSettingsStore } from './settings'

export const APPROVAL_ROLE_META: Record<ApprovalRole, { label: string; icon: string }> = {
  manager: { label: 'Менеджер', icon: 'ph:user' },
  head: { label: 'Руководитель', icon: 'ph:user-gear' },
  director: { label: 'Директор', icon: 'ph:crown-simple' },
}

export const APPROVAL_ROUTE: ApprovalRole[] = ['manager', 'head', 'director']

/** Кто из пользователей закрывает какой шаг маршрута. */
const ROLE_BY_USER: Partial<Record<UserRole, ApprovalRole>> = {
  manager: 'manager',
  commercial_director: 'head',
  controller: 'head',
  finance_director: 'head',
  director: 'director',
  admin: 'director',
}

export function approvalRoleOf(role: UserRole | undefined): ApprovalRole | null {
  return role ? ROLE_BY_USER[role] ?? null : null
}

export const useApprovalsStore = defineStore('approvals', {
  state: () => ({
    requests: [] as DiscountRequest[],
    loaded: false,
    loading: false,
  }),
  getters: {
    request: (s) => (id: string) => s.requests.find((r) => r.id === id),
    forLead: (s) => (leadId: string) => s.requests
      .filter((r) => r.leadId === leadId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    pending: (s) => s.requests.filter((r) => r.status === 'pending'),

    /** Шаг, на котором запрос стоит сейчас — по нему рисуется «ждём кого». */
    currentStep: () => (request: DiscountRequest) => request.steps.find((s) => s.decision === 'pending'),

    /** Одобренная скидка по заявке — её подставляет мастер сделок. */
    approvedPercentForLead(): (leadId: string) => number {
      return (leadId: string) => {
        const approved = this.forLead(leadId).filter((r: DiscountRequest) => r.status === 'approved')
        return approved.length ? Math.max(...approved.map((r: DiscountRequest) => r.percent)) : 0
      }
    },

    /** Запросы, которые ждут решения конкретной роли. */
    pendingForRole(): (role: ApprovalRole | null) => DiscountRequest[] {
      return (role: ApprovalRole | null) => {
        if (!role) return []
        return this.pending.filter((r: DiscountRequest) => this.currentStep(r)?.role === role)
      }
    },
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      this.requests = await repo.fetchDiscountRequests()
      this.loaded = true
      this.loading = false
    },

    /**
     * Маршрут строится по величине скидки: до лимита менеджера согласование не
     * нужно вовсе, выше — подключается руководитель, ещё выше — директор.
     * Так согласование не превращается в ритуал на каждые полпроцента.
     */
    routeFor(percent: number): ApprovalRole[] {
      const limits = useSettingsStore().discountLimits
      if (percent <= limits.manager) return []
      if (percent <= limits.head) return ['head']
      return ['head', 'director']
    },

    needsApproval(percent: number) {
      return this.routeFor(percent).length > 0
    },

    async request(input: {
      leadId?: string
      clientId: string
      unitId?: string
      contractId?: string
      basePrice: number
      percent: number
      reason: string
      requestedBy: string
      requestedById: string
    }) {
      const route = this.routeFor(input.percent)
      const now = new Date().toISOString()
      const request: DiscountRequest = {
        id: uid('dr'),
        leadId: input.leadId,
        clientId: input.clientId,
        unitId: input.unitId,
        contractId: input.contractId,
        basePrice: input.basePrice,
        percent: input.percent,
        amount: Math.round(input.basePrice * (input.percent / 100)),
        reason: input.reason,
        requestedBy: input.requestedBy,
        requestedById: input.requestedById,
        requestedAt: now,
        // скидка в пределах полномочий менеджера считается согласованной сразу
        status: route.length ? 'pending' : 'approved',
        steps: [
          { role: 'manager', decision: 'approved', decidedBy: input.requestedBy, decidedAt: now, comment: 'Запрос менеджера' },
          ...route.map((role) => ({ role, decision: 'pending' as ApprovalDecision })),
        ],
      }
      this.requests.unshift(request)
      await repo.saveDiscountRequest(request)
      return request
    },

    /**
     * Решение по текущему шагу. Отказ закрывает весь запрос: возвращать его
     * на доработку значит потерять, кто и почему отказал.
     */
    async decide(requestId: string, decision: 'approved' | 'rejected', user: string, comment?: string) {
      const request = this.request(requestId)
      if (!request || request.status !== 'pending') return
      const step = request.steps.find((s) => s.decision === 'pending')
      if (!step) return
      step.decision = decision
      step.decidedBy = user
      step.decidedAt = new Date().toISOString()
      step.comment = comment?.trim() || undefined

      if (decision === 'rejected') request.status = 'rejected'
      else if (!request.steps.some((s) => s.decision === 'pending')) request.status = 'approved'

      await repo.saveDiscountRequest(request)
      return request
    },

    async cancel(requestId: string, user: string) {
      const request = this.request(requestId)
      if (!request || request.status !== 'pending') return
      request.status = 'rejected'
      for (const step of request.steps) {
        if (step.decision === 'pending') {
          step.decision = 'rejected'
          step.decidedBy = user
          step.decidedAt = new Date().toISOString()
          step.comment = 'Запрос отозван'
        }
      }
      await repo.saveDiscountRequest(request)
    },
  },
})
