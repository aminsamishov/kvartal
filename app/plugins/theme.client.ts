export default defineNuxtPlugin(() => {
  const saved = localStorage.getItem('kvartal.theme')
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved
  }
})
