// Раздача собранной статики для демо по ссылке.
//
// Туннелировать dev-сервер нельзя: в режиме разработки Vite отдаёт сотни
// несобранных модулей отдельными запросами, и через туннель приложение просто
// не успевает загрузиться — упирается в задержку и лимиты. Собранная версия
// это десяток файлов, она открывается сразу.
//
// Без зависимостей: одна команда, ничего не ставится.
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(process.argv[3] ?? '.output/public')
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4000)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function fileAt(path) {
  try {
    const s = statSync(path)
    return s.isFile() ? path : null
  } catch {
    return null
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  // normalize + проверка префикса: без неё ../ в адресе уводит за пределы сборки
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  const target = join(ROOT, rel)
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  // приложение — SPA с маршрутизацией на клиенте: любой неизвестный путь должен
  // отдать оболочку, иначе прямая ссылка на /board или /calendar даёт 404
  const file = fileAt(target) ?? fileAt(join(target, 'index.html')) ?? join(ROOT, 'index.html')
  const type = TYPES[extname(file)] ?? 'application/octet-stream'

  res.writeHead(200, {
    'content-type': type,
    // хэш в имени файла делает содержимое неизменяемым, оболочку не кэшируем
    'cache-control': file.includes('/_nuxt/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}).listen(PORT, () => {
  console.log(`Демо: http://localhost:${PORT}  (каталог ${ROOT})`)
  console.log(`Ссылка наружу:  ngrok http ${PORT}`)
})
