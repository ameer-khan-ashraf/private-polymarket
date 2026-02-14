"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, Clock3, CheckCircle2, CircleHelp } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateMarket } from "../hooks/useCreateMarket";
import { supabase } from "../lib/supabaseClient";

type MarketListItem = {
  id: string;
  question_text: string;
  resolution_time: string;
  resolved: boolean;
  outcome: boolean | null;
  created_at: string;
};

export default function Home() {
  const { isConnected } = useAccount();
  const [question, setQuestion] = useState("");
  const [date, setDate] = useState("");
  const [markets, setMarkets] = useState<MarketListItem[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const router = useRouter();

  const { createMarket, isLoading, status, error } = useCreateMarket();

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const { data, error: fetchError } = await supabase
          .from("markets")
          .select(
            "id,question_text,resolution_time,resolved,outcome,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(30);

        if (fetchError) throw fetchError;
        setMarkets(data || []);
      } catch (err) {
        console.error("Failed to fetch markets:", err);
      } finally {
        setLoadingMarkets(false);
      }
    }

    fetchMarkets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !date) return;

    const result = await createMarket({ question, resolutionDate: date });

    if (result.success && result.supabaseId) {
      setQuestion("");
      setDate("");
      router.push(`/market/${result.supabaseId}`);
    }
  };

  return (
    <main className="min-h-screen p-6 md:p-12 bg-gray-900 text-white font-mono">
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Private Polymarket
        </p>
        <ConnectButton />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8">
        <section className="w-full p-8 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl h-fit">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Create New Market
          </h2>

          {!isConnected ? (
            <div className="text-center py-10 text-gray-400">
              Please connect your wallet to create a market.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Question
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  placeholder="e.g. Will ETH hit $10k by 2025?"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Resolution Date
                </label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-white inverted-calendar-icon"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-lg font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Create Market"
                )}
              </button>

              {status && (
                <div
                  className={`p-4 rounded-lg bg-gray-900 border border-gray-700 text-sm text-center ${
                    error ? "text-red-400" : "text-gray-300"
                  }`}
                >
                  {status}
                </div>
              )}
            </form>
          )}
        </section>

        <section className="w-full p-8 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
          <h2 className="text-2xl font-bold mb-4">Markets</h2>

          {loadingMarkets ? (
            <div className="py-10 flex items-center gap-2 text-gray-400">
              <Loader2 className="animate-spin w-4 h-4" />
              Loading markets...
            </div>
          ) : markets.length === 0 ? (
            <div className="py-10 text-gray-400">
              No markets yet. Create the first one.
            </div>
          ) : (
            <div className="space-y-3">
              {markets.map((market) => (
                <Link
                  key={market.id}
                  href={`/market/${market.id}`}
                  className="block p-4 rounded-lg bg-gray-900 border border-gray-700 hover:border-purple-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white leading-snug">
                        {market.question_text}
                      </p>
                      <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {new Date(market.resolution_time).toLocaleString()}
                      </p>
                    </div>
                    <StatusPill
                      resolved={market.resolved}
                      outcome={market.outcome}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  resolved,
  outcome,
}: {
  resolved: boolean;
  outcome: boolean | null;
}) {
  if (!resolved) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
        <CircleHelp className="w-3 h-3" />
        Open
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" />
      {outcome ? "Resolved: YES" : "Resolved: NO"}
    </span>
  );
}
