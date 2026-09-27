// Открывает системный диалог выбора файла и возвращает выбранные файлы.
// Реального аплоада на сервер нет (фронтенд-прототип) — превью строится через
// object URL, живёт в памяти вкладки, чего достаточно для демонстрации потока.
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files ? Array.from(input.files) : [])
      input.remove()
    }, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

export function fileToObjectUrl(file: File) {
  return URL.createObjectURL(file)
}

export function fileKind(file: File): 'photo' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'photo'
}
