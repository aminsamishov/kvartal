import { ROLE_LABELS, USERS } from '~/data/catalog'
import * as authRepo from '~/repositories/auth'
import { clone } from '~/repositories/api'
import type { AppUser } from '~/types/models'

const STORAGE_KEY = 'kvartal.session'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AppUser | null,
    phoneInput: '',
    step: 'phone' as 'phone' | 'code',
    demoCode: '',
    loading: false,
    error: '' as string,
    restored: false,
  }),
  getters: {
    isAuthed: (s) => !!s.user,
    roleLabel: (s) => (s.user ? ROLE_LABELS[s.user.role] : ''),
  },
  actions: {
    restore() {
      if (this.restored) return
      this.restored = true
      if (!import.meta.client) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) this.user = JSON.parse(raw)
      } catch {
        // игнорируем повреждённую сессию
      }
    },
    async sendCode(phone: string) {
      this.loading = true
      this.error = ''
      try {
        const digits = phone.replace(/\D/g, '')
        if (digits.length < 9) throw new Error('Введите номер телефона полностью')
        this.phoneInput = digits
        const res = await authRepo.requestCode(digits)
        this.demoCode = res.demoCode
        this.step = 'code'
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Не удалось отправить код'
      } finally {
        this.loading = false
      }
    },
    async confirmCode(code: string) {
      this.loading = true
      this.error = ''
      try {
        if (code.length < 4) throw new Error('Введите код из СМС')
        const user = await authRepo.verifyCode(this.phoneInput, code)
        this.user = user
        if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Неверный код'
      } finally {
        this.loading = false
      }
    },
    backToPhone() {
      this.step = 'phone'
      this.error = ''
    },
    /**
     * Вход одним нажатием — для демо-ссылки, которую открывают посторонние.
     * Раньше кнопка роли только подставляла телефон в поле, и человеку всё
     * равно приходилось запрашивать код и вводить его: по ссылке, присланной
     * «посмотреть», это выглядит как неработающий вход.
     */
    loginAsDemo(userId: string) {
      const user = USERS.find((u) => u.id === userId)
      if (!user) { this.error = 'Демо-пользователь не найден'; return }
      this.user = clone(user)
      this.error = ''
      this.step = 'phone'
      this.phoneInput = user.phone
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user))
    },
    logout() {
      this.user = null
      this.step = 'phone'
      this.phoneInput = ''
      if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
    },
  },
})
