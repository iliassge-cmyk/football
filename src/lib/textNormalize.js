// Folds accented/special characters down to plain ASCII so typing "Blaszczykowski"
// matches the stored "Błaszczykowski", "Hojbjerg" matches "Højbjerg", etc.
//
// Most accents (é, ñ, ć, š...) have a canonical Unicode decomposition into a
// base letter + a combining mark, so Normalize('NFD') + stripping combining
// marks (U+0300-U+036F) handles them. A handful of letters that merely *look*
// like a modified Latin letter are not decomposable that way — they're their
// own distinct code points (ł, ø, æ, ß...) — so those need an explicit map
// applied first.
const CHAR_MAP = {
  ł: 'l', Ł: 'l',
  ø: 'o', Ø: 'o',
  æ: 'ae', Æ: 'ae',
  œ: 'oe', Œ: 'oe',
  ß: 'ss',
  đ: 'd', Đ: 'd',
  ð: 'd', Ð: 'd',
  þ: 'th', Þ: 'th',
  ı: 'i', İ: 'i',
  ŋ: 'n', Ŋ: 'n',
}

export function foldDiacritics(s) {
  return s
    .split('')
    .map((ch) => CHAR_MAP[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Trim + fold diacritics + lowercase — the shared "compare these two names" key. */
export function normalizeSearch(s) {
  return foldDiacritics(s.trim()).toLowerCase()
}
