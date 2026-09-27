import * as repo from '~/repositories/settings'
import { uid } from '~/repositories/api'
import type { AppUser, DocumentTemplate, PaymentMethod, Promotion, SalesOffice, TemplateVariable, UnitOption } from '~/types/models'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    promotions: [] as Promotion[],
    paymentMethods: [] as PaymentMethod[],
    unitOptions: [] as UnitOption[],
    docTemplates: [] as DocumentTemplate[],
    variables: [] as TemplateVariable[],
    salesOffices: [] as SalesOffice[],
    users: [] as AppUser[],
    accountCountry: 'Кыргызстан',
    accountCurrency: 'USD' as 'USD' | 'KGS',
    dealSettings: {
      discountOrder: 'independent' as 'independent' | 'sequential',
      requireClientFields: ['ФИО', 'Телефон', 'Паспорт'] as string[],
      requireRepFields: ['ФИО', 'Доверенность'] as string[],
    },
    /**
     * Лимиты скидки по ролям, %. Скидка до лимита менеджера применяется без
     * согласования, выше — идёт руководителю, ещё выше — директору.
     */
    discountLimits: {
      manager: 3,
      head: 7,
      director: 15,
    },
    reservationSettings: {
      noDepositDays: 1,
      confirmedDays: 3,
      depositDays: 30,
      minDeposit: 100000,
      autoQueueTransfer: true,
      clearQueueOnConvert: true,
    },
    calculatorEnabled: true,
    loaded: false,
    loading: false,
  }),
  getters: {
    variableGroups: (s) => [...new Set(s.variables.map((v) => v.group))],
  },
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      const [promotions, paymentMethods, unitOptions, docTemplates, variables, salesOffices, users] = await Promise.all([
        repo.fetchPromotions(), repo.fetchPaymentMethods(), repo.fetchUnitOptions(),
        repo.fetchDocTemplates(), repo.fetchTemplateVariables(), repo.fetchSalesOffices(), repo.fetchUsers(),
      ])
      this.promotions = promotions
      this.paymentMethods = paymentMethods
      this.unitOptions = unitOptions
      this.docTemplates = docTemplates
      this.variables = variables
      this.salesOffices = salesOffices
      this.users = users
      this.loaded = true
      this.loading = false
    },
    togglePromotion(id: string) {
      const p = this.promotions.find((x) => x.id === id)
      if (p) p.active = !p.active
    },
    addPromotion(data: Omit<Promotion, 'id'>) {
      const item: Promotion = { ...data, id: uid('promo') }
      this.promotions.unshift(item)
      return item
    },
    removePromotion(id: string) {
      this.promotions = this.promotions.filter((p) => p.id !== id)
    },
    togglePaymentMethod(id: string) {
      const m = this.paymentMethods.find((x) => x.id === id)
      if (m) m.active = !m.active
    },
    addPaymentMethod(data: Omit<PaymentMethod, 'id'>) {
      const item: PaymentMethod = { ...data, id: uid('pm') }
      this.paymentMethods.unshift(item)
      return item
    },
    toggleOption(id: string) {
      const o = this.unitOptions.find((x) => x.id === id)
      if (o) o.active = !o.active
    },
    addOption(data: Omit<UnitOption, 'id'>) {
      const item: UnitOption = { ...data, id: uid('opt') }
      this.unitOptions.unshift(item)
      return item
    },
    toggleTemplate(id: string) {
      const t = this.docTemplates.find((x) => x.id === id)
      if (t) t.active = !t.active
    },
    addTemplate(data: Omit<DocumentTemplate, 'id' | 'updatedAt'>) {
      const item: DocumentTemplate = { ...data, id: uid('tpl'), updatedAt: new Date().toISOString() }
      this.docTemplates.unshift(item)
      return item
    },
    removeTemplate(id: string) {
      this.docTemplates = this.docTemplates.filter((t) => t.id !== id)
    },
    addOffice(data: Omit<SalesOffice, 'id'>) {
      const item: SalesOffice = { ...data, id: uid('office') }
      this.salesOffices.unshift(item)
      return item
    },
    toggleUserActive(id: string) {
      const u = this.users.find((x) => x.id === id)
      if (u) u.active = !u.active
    },
    addUser(data: Omit<AppUser, 'id' | 'avatarColor'>) {
      const palette = ['#6E4453', '#2F7D5C', '#3A6EA5', '#B8780E', '#B93A2F', '#A77886']
      const item: AppUser = { ...data, id: uid('user'), avatarColor: palette[this.users.length % palette.length]! }
      this.users.unshift(item)
      return item
    },
  },
})
