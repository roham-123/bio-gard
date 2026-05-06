import { NextResponse } from "next/server";
import { getFxSettings, recordLiveFxRates } from "@/lib/db";

export const dynamic = "force-dynamic";

export type FxRatesResponse = {
  rates: { EUR: number; PLN: number; USD: number };
  date: string;
  /** True when the upstream API call failed and we returned cached rates. */
  stale: boolean;
  /** ISO timestamp of the last successful upstream fetch (cached responses only). */
  fetchedAt: string | null;
  /** Upstream error detail when stale=true. Null on fresh responses. */
  error: string | null;
};

type FrankfurterResponse = {
  date?: string;
  rates?: {
    EUR?: number;
    PLN?: number;
    USD?: number;
  };
};

async function fetchUpstream(): Promise<{
  rates: { EUR: number; PLN: number; USD: number };
  date: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=GBP&to=EUR,PLN,USD",
      { cache: "no-store", signal: controller.signal }
    );
    if (!res.ok) {
      throw new Error(`Upstream FX API returned ${res.status}`);
    }
    const data = (await res.json()) as FrankfurterResponse;
    if (
      !data.rates ||
      typeof data.rates.EUR !== "number" ||
      typeof data.rates.PLN !== "number" ||
      typeof data.rates.USD !== "number"
    ) {
      throw new Error("Upstream FX API response missing rates");
    }
    return {
      rates: { EUR: data.rates.EUR, PLN: data.rates.PLN, USD: data.rates.USD },
      date: data.date ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  let upstreamError: string | null = null;

  try {
    const fresh = await fetchUpstream();
    // Best-effort cache write — never fails the response if it errors.
    void recordLiveFxRates({
      EUR: fresh.rates.EUR,
      PLN: fresh.rates.PLN,
      USD: fresh.rates.USD,
      date: fresh.date || null,
    }).catch((err) => {
      console.error("Failed to cache live FX rates:", err);
    });

    return NextResponse.json<FxRatesResponse>(
      { rates: fresh.rates, date: fresh.date, stale: false, fetchedAt: null, error: null },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    upstreamError = err instanceof Error ? err.message : "Failed to fetch upstream FX rates";
  }

  // Upstream failed — try to serve the last confirmed rates from the DB cache.
  try {
    const settings = await getFxSettings();
    if (settings.lastLiveRates) {
      return NextResponse.json<FxRatesResponse>(
        {
          rates: {
            EUR: settings.lastLiveRates.EUR,
            PLN: settings.lastLiveRates.PLN,
            USD: settings.lastLiveRates.USD,
          },
          date: settings.lastLiveRateDate ?? "",
          stale: true,
          fetchedAt: settings.lastLiveFetchedAt,
          error: upstreamError,
        },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }
  } catch (cacheErr) {
    console.error("Failed to read cached FX rates:", cacheErr);
  }

  // No upstream and no cache — caller will fall back to BOOTSTRAP_FX_RATES.
  return NextResponse.json({ error: upstreamError }, { status: 502 });
}
