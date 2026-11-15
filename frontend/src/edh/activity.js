// Tiny shared store of what each character is doing right now (real activity only).
// RECONSTRUCTED from usage: setActivity(id, label|null) and useActivities() -> Map(id -> label).
import { useEffect, useState } from 'react';

let current = new Map();
const listeners = new Set();

export function setActivity(id, label) {
  const next = new Map(current);
  if (label) next.set(id, label); else next.delete(id);
  current = next;
  listeners.forEach((fn) => fn(current));
}

export function useActivities() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    setValue(current);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}
