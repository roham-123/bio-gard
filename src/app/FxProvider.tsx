"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CurrencyCode } from "@/lib/format";
import { getFxSettingsAction, updateFxSettingsAction } from "@/app/actions";

export type FxMode = "live" | "fixed";

export const CURRENCIES: CurrencyCode[] = ["GBP", "EUR", "PLN", "USD"];

const DEFAULT_RATES: Record<CurrencyCode, number> = {
  GBP: 1,
  EUR: 1.17,
  PLN: 5.05,
  USD: 1.27,
};

const CURRENCY_STORAGE_KEY = "biogard:fx-currency";
const LIVE_CACHE_KEY = "biogard:fx-live-cache";

type StoredCurrency = {
  currency?: CurrencyCode;
};

type LiveCache = {
  liveRates?: Partial<Record<CurrencyCode, number>>;
  liveRatesUpdatedAt?: string;
};

type FxContextValue = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  mode: FxMode;
  setMode: (m: FxMode) => void;
  liveRates: Record<CurrencyCode, number>;
  fixedRates: Record<CurrencyCode, number>;
  setFixedRate: (c: CurrencyCode, rate: number) => void;
  liveRatesUpdatedAt: string;
  liveStatus: "loading" | "ready" | "error";
  liveError: string | null;
  refreshLiveRates: () => Promise<void>;
  activeRates: Record<CurrencyCode, number>;
  rate: number;
};

const FxContext = createContext<FxContextValue | null>(null);

function sanitizeRates(
  source: Partial<Record<CurrencyCode, number>> | undefined,
  fallback: Record<CurrencyCode, number>
): Record<CurrencyCode, number> {
  const out = { ...fallback };
  if (!source) return out;
  for (const code of CURRENCIES) {
    const v = source[code];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[code] = v;
    }
  }
  out.GBP = 1;
  return out;
}

export function FxProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("GBP");
  const [mode, setModeState] = useState<FxMode>("live");
  const [liveRates, setLiveRates] = useState<Record<CurrencyCode, number>>(DEFAULT_RATES);
  const [fixedRates, setFixedRates] = useState<Record<CurrencyCode, number>>(DEFAULT_RATES);
  const [liveRatesUpdatedAt, setLiveRatesUpdatedAt] = useState<string>("");
  const [liveStatus, setLiveStatus] = useState<"loading" | "ready" | "error">("loading");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [fxSettingsLoaded, setFxSettingsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredCurrency;
        if (parsed.currency && CURRENCIES.includes(parsed.currency)) {
          setCurrencyState(parsed.currency);
        }
      }
      const liveRaw = localStorage.getItem(LIVE_CACHE_KEY);
      if (liveRaw) {
        const parsedLive = JSON.parse(liveRaw) as LiveCache;
        if (parsedLive.liveRates) {
          setLiveRates(sanitizeRates(parsedLive.liveRates, DEFAULT_RATES));
        }
        if (typeof parsedLive.liveRatesUpdatedAt === "string") {
          setLiveRatesUpdatedAt(parsedLive.liveRatesUpdatedAt);
        }
      }
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify({ currency }));
    } catch {
      // ignore quota / privacy errors
    }
  }, [hydrated, currency]);

  useEffect(() => {
    let cancelled = false;
    const loadFxSettings = async () => {
      try {
        const settings = await getFxSettingsAction();
        if (cancelled) return;
        setModeState(settings.mode);
        setFixedRates(
          sanitizeRates(
            {
              GBP: 1,
              EUR: settings.fixedRates.EUR,
              PLN: settings.fixedRates.PLN,
              USD: settings.fixedRates.USD,
            },
            DEFAULT_RATES
          )
        );
      } catch {
        // keep defaults if DB settings cannot be loaded
      } finally {
        if (!cancelled) setFxSettingsLoaded(true);
      }
    };
    void loadFxSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fxSettingsLoaded) return;
    const persistFxSettings = async () => {
      try {
        await updateFxSettingsAction(mode, {
          EUR: fixedRates.EUR,
          PLN: fixedRates.PLN,
          USD: fixedRates.USD,
        });
      } catch {
        // keep in-memory values; next successful save will sync DB
      }
    };
    void persistFxSettings();
  }, [fxSettingsLoaded, mode, fixedRates]);

  const refreshLiveRates = useCallback(async (showLoading = true) => {
    if (showLoading) setLiveStatus("loading");
    setLiveError(null);
    try {
      const res = await fetch("/api/fx-rates", {
        cache: "no-store",
      });
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = body.error ? `: ${body.error}` : "";
        } catch {
          // ignore parsing error
        }
        throw new Error(`FX API returned ${res.status}${detail}`);
      }
      const data = (await res.json()) as {
        date?: string;
        rates?: { EUR?: number; PLN?: number; USD?: number };
      };
      if (!data.rates) {
        throw new Error("FX API response missing rates");
      }
      const incomingRates: Partial<Record<CurrencyCode, number>> = {
        GBP: 1,
        EUR: data.rates.EUR,
        PLN: data.rates.PLN,
        USD: data.rates.USD,
      };
      let nextRates = DEFAULT_RATES;
      setLiveRates((prev) => {
        nextRates = sanitizeRates(incomingRates, prev);
        return nextRates;
      });
      const nextUpdatedAt = data.date ?? "";
      setLiveRatesUpdatedAt(nextUpdatedAt);
      setLiveStatus("ready");
      if (hydrated) {
        const payload: LiveCache = {
          liveRates: nextRates,
          liveRatesUpdatedAt: nextUpdatedAt,
        };
        localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(payload));
      }
    } catch (err) {
      setLiveStatus("error");
      setLiveError(err instanceof Error ? err.message : "Failed to fetch live rates.");
    }
  }, [hydrated]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await refreshLiveRates(false);
    };

    void run();
    const id = window.setInterval(run, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshLiveRates]);

  const setCurrency = useCallback((c: CurrencyCode) => setCurrencyState(c), []);
  const setMode = useCallback((m: FxMode) => setModeState(m), []);
  const setFixedRate = useCallback((c: CurrencyCode, rate: number) => {
    if (!Number.isFinite(rate) || rate <= 0) return;
    setFixedRates((prev) => ({ ...prev, [c]: c === "GBP" ? 1 : rate }));
  }, []);

  const activeRates = mode === "live" ? liveRates : fixedRates;
  const raw = activeRates[currency] ?? 1;
  const rate = Number.isFinite(raw) && raw > 0 ? raw : 1;

  const value = useMemo<FxContextValue>(
    () => ({
      currency,
      setCurrency,
      mode,
      setMode,
      liveRates,
      fixedRates,
      setFixedRate,
      liveRatesUpdatedAt,
      liveStatus,
      liveError,
      refreshLiveRates,
      activeRates,
      rate,
    }),
    [
      currency,
      setCurrency,
      mode,
      setMode,
      liveRates,
      fixedRates,
      setFixedRate,
      liveRatesUpdatedAt,
      liveStatus,
      liveError,
      refreshLiveRates,
      activeRates,
      rate,
    ]
  );

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx(): FxContextValue {
  const ctx = useContext(FxContext);
  if (!ctx) throw new Error("useFx must be used within an FxProvider");
  return ctx;
}
