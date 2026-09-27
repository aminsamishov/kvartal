// Общий слой "API". Сейчас функции читают/пишут в мок-данные в памяти,
// с имитацией сетевой задержки — чтобы стор и компоненты уже сегодня работали
// так, как будут работать с реальным бэкендом (await repo.fetchX()).
// Когда появится сервер, меняется только реализация внутри repositories/*,
// сигнатуры и стор — нет.

export function delay<T>(value: T, ms = 220): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

export class ApiError extends Error {}
