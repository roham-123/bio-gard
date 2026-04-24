import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FrankfurterResponse = {
  date?: string;
  rates?: {
    EUR?: number;
    PLN?: number;
    USD?: number;
  };
};

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      "https://api.frankfurter.app/latest?from=GBP&to=EUR,PLN,USD",
      {
        cache: "no-store",
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream FX API returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as FrankfurterResponse;
    const rates = data.rates;

    if (!rates) {
      return NextResponse.json(
        { error: "Upstream FX API response missing rates" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        date: data.date ?? "",
        rates: {
          EUR: rates.EUR,
          PLN: rates.PLN,
          USD: rates.USD,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch upstream FX rates",
      },
      { status: 500 }
    );
  }
}
