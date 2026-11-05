/** Geometry-free connected components. Names, coordinates and drawing order have
 * no effect on connectivity. The smallest endpoint key is the canonical root. */
export class PortGraph {
  private parent = new Map<string, string>();

  add(key: string): void {
    if (!this.parent.has(key)) this.parent.set(key, key);
  }

  root(key: string): string {
    this.add(key);
    let result = key;
    while (this.parent.get(result)! !== result) result = this.parent.get(result)!;
    while (key !== result) {
      const next = this.parent.get(key)!;
      this.parent.set(key, result);
      key = next;
    }
    return result;
  }

  join(a: string, b: string): void {
    const ra = this.root(a), rb = this.root(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }

  groups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.root(key);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(key);
    }
    return new Map([...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([id, pins]) => [id, pins.sort()]));
  }
}
