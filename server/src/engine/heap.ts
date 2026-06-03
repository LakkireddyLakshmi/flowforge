/**
 * A binary min-heap — the beating heart of the discrete-event scheduler.
 *
 * The simulation never advances in fixed time steps. Instead it keeps a pile of
 * "things that will happen" (events), each stamped with the virtual time it
 * happens at, and always processes the *earliest* one next. A min-heap gives us
 * that earliest item in O(log n) for both insert and remove — which is why a
 * simulation with millions of events stays fast.
 */
export class MinHeap<T> {
  private items: T[] = [];

  /** `less(a, b)` must return true when `a` should come out before `b`. */
  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const items = this.items;
    items.push(item);
    // bubble the new item up until its parent is smaller
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(items[i], items[parent])) {
        [items[i], items[parent]] = [items[parent], items[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftDown(i: number): void {
    const items = this.items;
    const n = items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.less(items[left], items[smallest])) smallest = left;
      if (right < n && this.less(items[right], items[smallest])) smallest = right;
      if (smallest === i) break;
      [items[i], items[smallest]] = [items[smallest], items[i]];
      i = smallest;
    }
  }
}
