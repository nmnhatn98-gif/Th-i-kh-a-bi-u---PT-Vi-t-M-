export const normalizeSuggestionSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function matchesSuggestionSearch(query, ...fields) {
 const haystack = normalizeSuggestionSearch(fields.join(' '));
 return normalizeSuggestionSearch(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}
