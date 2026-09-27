export interface Toast {
  id: number
  text: string
  kind: 'ok' | 'warn' | 'bad' | 'info'
}

let toastSeq = 1

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarCollapsed: false,
    mobileNavOpen: false,
    currentProjectId: 'aurora' as string,
    toasts: [] as Toast[],
    commandOpen: false,
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setProject(id: string) {
      this.currentProjectId = id
    },
    toast(text: string, kind: Toast['kind'] = 'info') {
      const id = toastSeq++
      this.toasts.push({ id, text, kind })
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id)
      }, 3600)
    },
    dismissToast(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
