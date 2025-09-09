// Minimal pub/sub event bus
export function createEventBus() {
  const listeners = new Map();
  return {
    on(type, fn) {
      const arr = listeners.get(type) || [];
      arr.push(fn);
      listeners.set(type, arr);
      return () => {
        const a = listeners.get(type) || [];
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i, 1);
      };
    },
    emit(type, payload) {
      const arr = listeners.get(type) || [];
      for (const fn of arr) fn(payload);
    },
  };
}


