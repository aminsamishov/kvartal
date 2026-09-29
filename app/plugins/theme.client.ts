export default defineNuxtPlugin(() => {
  const saved = localStorage.getItem('inhouse.theme')
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved
  }
})
