// Vietnamese-diacritic-insensitive substring match for the Captions search
// box (UI_DESIGN_SPEC.md §5.1 cụm 2) — "kinh thanh" must match "Kinh thánh".
// NFD splits each accented character into base + combining marks, so
// stripping \p{Diacritic} (Unicode category Mn) leaves the bare base
// letters; 'đ'/'Đ' don't decompose that way (they're their own code
// points, not a base letter + mark), so they're folded to 'd'/'D' first.
export function normalizeForSearch(s: string): string {
  return s
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true
  return normalizeForSearch(text).includes(normalizeForSearch(query))
}
