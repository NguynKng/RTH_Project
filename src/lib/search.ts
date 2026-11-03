export const normalise = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export function matchesSearch(query: string, values: string[]) {
  const terms = normalise(query).split(" ").filter(Boolean);
  const haystack = normalise(values.join(" "));
  return terms.every((term) => haystack.includes(term));
}
