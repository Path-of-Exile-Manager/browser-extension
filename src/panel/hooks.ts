import { useEffect, useState } from "react";
import { DEFAULTS, read, subscribe, type StorageKey, type StorageShape } from "@/shared/storage";
import { useTrade } from "./bridge";
import type { GameVersion } from "@/shared/types";

/** Значение из chrome.storage.local с подпиской на изменения (в том числе из страницы). */
export function useStored<K extends StorageKey>(key: K): { value: StorageShape[K]; loaded: boolean } {
  const [state, setState] = useState<{ value: StorageShape[K]; loaded: boolean }>({ value: DEFAULTS[key], loaded: false });
  useEffect(() => {
    let alive = true;
    void read(key).then((value) => alive && setState({ value, loaded: true }));
    const unsubscribe = subscribe(key, (value) => setState({ value, loaded: true }));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [key]);
  return state;
}

/** Версия игры текущей страницы; без связи со страницей — PoE 1. */
export function useGameVersion(): GameVersion {
  return useTrade((s) => s.location?.version ?? "1");
}
