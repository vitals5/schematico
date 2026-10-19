/** A multilingual field is a set of translations, not consecutive labels. */
export function nativeXmlText(value: string): string {
  const entries = [...value.matchAll(/(?:^|;)([a-z?]{2}_[A-Z?]{2})@([\s\S]*?)(?=;[a-z?]{2}_[A-Z?]{2}@|$)/g)];
  if (!entries.length) return value;
  return (entries.find(e => e[1] === 'de_DE') ?? entries.find(e => e[1] === 'en_US') ?? entries[0])[2].replace(/;$/, '');
}
