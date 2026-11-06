/** File names, archive paths and filesystem timestamps are not inputs. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
/** Fixed input order; lengths prevent bytes from crossing table boundaries. */
export async function nativeSourceIdentity(
  page: Uint8Array,
  functions: Uint8Array,
  pageIndex: Uint8Array = new Uint8Array(),
  functionIndex: Uint8Array = new Uint8Array(),
) {
  const prefix = new TextEncoder().encode('schematico-native-tables-v1\0');
  const tables = [page, functions, pageIndex, functionIndex];
  const bytes = new Uint8Array(
      prefix.length + tables.reduce((n, t) => n + 4 + t.length, 0),
    ),
    view = new DataView(bytes.buffer);
  bytes.set(prefix);
  let at = prefix.length;
  for (const table of tables) {
    view.setUint32(at, table.length);
    at += 4;
    bytes.set(table, at);
    at += table.length;
  }
  return {
    algorithm: 'sha256-native-tables-v1' as const,
    digest: await sha256(bytes),
  };
}
