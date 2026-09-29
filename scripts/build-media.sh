#!/usr/bin/env bash
# Сборка веб-версий материалов ЖК «Айни Ороз» из буклета застройщика.
#
# Оригиналы (2.2 ГБ: рендеры до 99 МБ, планировки в PDF) лежат рядом с
# репозиторием и не коммитятся. Сюда попадают только сжатые версии в размерах,
# пригодных для интерфейса. Скрипт идемпотентный: гоняется заново, когда
# застройщик присылает новый буклет.
#
# Требуется: sips (входит в macOS), pdftoppm (brew install poppler).
set -euo pipefail

SRC="${1:-Айни Ороз }"
OUT="public/media/aini"

[ -d "$SRC" ] || { echo "Нет папки с исходниками: $SRC" >&2; exit 1; }
command -v pdftoppm >/dev/null || { echo "Нужен pdftoppm: brew install poppler" >&2; exit 1; }

mkdir -p "$OUT"/{renders,floors,layouts,plans}

# Транслитерация литеры типа квартиры: 2А -> 2a. Имена файлов в проекте
# латиницей — кириллица в URL ломается при копировании ссылок и на части
# статических хостингов.
translit() {
  printf '%s' "$1" | sed -e 's/А/a/g' -e 's/Б/b/g' -e 's/В/v/g' -e 's/Г/g/g' -e 's/Д/d/g'
}

tier_slug() {
  case "$1" in
    *3эт|*3-этаж) echo "t3" ;;
    *4-7эт|*4-7-этаж) echo "t4-7" ;;
    *8-14эт|*8-14-этаж) echo "t8-14" ;;
    *) echo "unknown" ;;
  esac
}

echo "→ Рендеры ЖК"
n=0
for f in "$SRC"/[0-9]*.png "$SRC"/[0-9]*.jpg; do
  [ -e "$f" ] || continue
  base=$(basename "$f"); num="${base%.*}"
  # печатаем с ведущим нулём, чтобы галерея сортировалась как у застройщика
  out=$(printf '%s/renders/%02d.jpg' "$OUT" "$num")
  sips -s format jpeg -s formatOptions 70 -Z 1400 "$f" --out "$out" >/dev/null
  n=$((n+1))
done
echo "  готово: $n"

echo "→ Планы этажей"
for pdf in "$SRC"/2Д\ Планировка\ /*/[0-9]*\ этаж.pdf; do
  [ -e "$pdf" ] || continue
  tier=$(tier_slug "$(dirname "$pdf")")
  pdftoppm -jpeg -jpegopt quality=82 -r 130 -singlefile "$pdf" "$OUT/floors/$tier"
  echo "  $tier"
done

echo "→ 3D-планировки квартир"
n=0
for img in "$SRC"/3Д\ планировка\ /*/*/*.jpg; do
  [ -e "$img" ] || continue
  tier=$(tier_slug "$(basename "$(dirname "$(dirname "$img")")")")
  blk=$(basename "$(dirname "$img")"); blk=$(translit "${blk#блок }")
  name=$(basename "$img" .jpg)            # «кв 2А 75,9»
  type=$(printf '%s' "$name" | awk '{print $2}')
  type=$(translit "$type" | tr 'A-Z' 'a-z')
  # «студия» в имени — отдельная планировка того же литера, её нельзя схлопнуть
  case "$name" in *студия*) type="$type-studio" ;; esac
  sips -s format jpeg -s formatOptions 84 -Z 1400 "$img" --out "$OUT/layouts/$tier-$blk-$type.jpg" >/dev/null
  n=$((n+1))
done
echo "  готово: $n"

echo "→ 2D-планы квартир"
n=0
for pdf in "$SRC"/2Д\ Планировка\ /*/*-подъезд/*.pdf; do
  [ -e "$pdf" ] || continue
  tier=$(tier_slug "$(basename "$(dirname "$(dirname "$pdf")")")")
  sec=$(basename "$(dirname "$pdf")"); sec="${sec%%-*}"
  idx=$(basename "$pdf" .pdf | sed -n 's/^№\([0-9]*\).*/\1/p')
  [ -n "$idx" ] || continue
  pdftoppm -jpeg -jpegopt quality=84 -r 120 -singlefile "$pdf" "$OUT/plans/$tier-s$sec-$idx"
  n=$((n+1))
done
echo "  готово: $n"

echo
du -sh "$OUT"/* | sed 's/^/  /'
echo "Всего: $(du -sh "$OUT" | cut -f1)"
