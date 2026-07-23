export type Comparator<T> = (a: T, b: T) => number;

export function byString<T>(getField: (item: T) => string): Comparator<T> {
  return (a, b) => getField(a).localeCompare(getField(b));
}

export function byStringDesc<T>(getField: (item: T) => string): Comparator<T> {
  return (a, b) => getField(b).localeCompare(getField(a));
}

export function byNumberAsc<T>(getField: (item: T) => number): Comparator<T> {
  return (a, b) => getField(a) - getField(b);
}

export function byNumberDesc<T>(getField: (item: T) => number): Comparator<T> {
  return (a, b) => getField(b) - getField(a);
}

// Combine comparators, falling through to the next one on a tie.
export function thenBy<T>(...comparators: Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}
