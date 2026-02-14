"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../../lib/supabaseClient";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther, parseGwei } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import PrivateMarketABI from "../../../lib/abi/PrivateMarket.json";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Coins,
  Gavel,
  Loader2,
  Trophy,
  XCircle,
} from "lucide-react";
import { TugOfWar } from "../../../components/TugOfWar";

type MarketData = {
  id: string;
  question_text: string;
  image_url: string | null;
  chain_market_id: number;
  resolution_time: string;
  resolved: boolean;
  outcome: boolean | null;
};

type PendingAction = "bet" | "resolve" | "claim" | null;

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { address, isConnected } = useAccount();

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [betAmount, setBetAmount] = useState<string>("0.1");
  const [selectedSide, setSelectedSide] = useState<"YES" | "NO">("YES");
  const [status, setStatus] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingResolutionOutcome, setPendingResolutionOutcome] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    async function fetchMarket() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("markets")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setMarketData(data);
      } catch (err) {
        console.error("Error fetching market metadata:", err);
        setStatus("Error loading market data.");
      } finally {
        setLoadingMetadata(false);
      }
    }

    fetchMarket();
  }, [id]);

  const isChainDataReady =
    marketData !== null && typeof marketData.chain_market_id === "number";

  const contractAddress = process.env
    .NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS as `0x${string}`;
  const minPriorityFeePerGas = parseGwei("30");
  const maxFeePerGas = parseGwei("60");

  const {
    data: contractMarket,
    refetch: refetchContractData,
    isLoading: loadingContract,
  } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "getMarket",
    args: isChainDataReady ? [BigInt(marketData.chain_market_id)] : undefined,
    query: {
      enabled: isChainDataReady,
    },
  });

  const { data: userBet, refetch: refetchUserBet } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "getUserBet",
    args:
      isChainDataReady && address
        ? [BigInt(marketData.chain_market_id), address]
        : undefined,
    query: {
      enabled: isChainDataReady && !!address,
    },
  });

  const { data: payoutData, refetch: refetchPayout } = useReadContract({
    address: contractAddress,
    abi: PrivateMarketABI,
    functionName: "calculatePayout",
    args:
      isChainDataReady && address
        ? [BigInt(marketData.chain_market_id), address]
        : undefined,
    query: {
      enabled: isChainDataReady && !!address,
    },
  });

  const {
    writeContract,
    data: hash,
    isPending: isWritePending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const watchedMarketId = isChainDataReady
    ? BigInt(marketData.chain_market_id)
    : null;

  const onMarketEvent = useCallback(() => {
    refetchContractData();
    refetchUserBet();
    refetchPayout();
  }, [refetchContractData, refetchPayout, refetchUserBet]);

  const shouldRefetchForLogs = (logs: readonly unknown[]) =>
    watchedMarketId !== null &&
    logs.some(
      (log) =>
        (log as { args?: { marketId?: bigint } })?.args?.marketId ===
        watchedMarketId,
    );

  useWatchContractEvent({
    address: contractAddress,
    abi: PrivateMarketABI,
    eventName: "BetPlaced",
    onLogs(logs) {
      if (shouldRefetchForLogs(logs)) onMarketEvent();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: PrivateMarketABI,
    eventName: "MarketResolved",
    onLogs(logs) {
      if (shouldRefetchForLogs(logs)) onMarketEvent();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: PrivateMarketABI,
    eventName: "WinningsClaimed",
    onLogs(logs) {
      if (shouldRefetchForLogs(logs)) onMarketEvent();
    },
  });

  useWatchContractEvent({
    address: contractAddress,
    abi: PrivateMarketABI,
    eventName: "RefundClaimed",
    onLogs(logs) {
      if (shouldRefetchForLogs(logs)) onMarketEvent();
    },
  });

  useEffect(() => {
    if (!isConfirmed || !pendingAction) return;

    async function finalizeConfirmedTransaction() {
      onMarketEvent();

      if (
        pendingAction === "resolve" &&
        marketData &&
        pendingResolutionOutcome !== null
      ) {
        const { error } = await supabase
          .from("markets")
          .update({
            resolved: true,
            outcome: pendingResolutionOutcome,
          })
          .eq("id", marketData.id);

        if (!error) {
          setMarketData((prev) =>
            prev
              ? {
                  ...prev,
                  resolved: true,
                  outcome: pendingResolutionOutcome,
                }
              : prev,
          );
        }
      }

      if (pendingAction === "bet") setStatus("Success! Bet confirmed.");
      if (pendingAction === "resolve")
        setStatus("Market resolved successfully.");
      if (pendingAction === "claim") setStatus("Claim confirmed.");

      setPendingAction(null);
      setPendingResolutionOutcome(null);
    }

    void finalizeConfirmedTransaction();
  }, [
    isConfirmed,
    pendingAction,
    marketData,
    pendingResolutionOutcome,
    onMarketEvent,
  ]);

  const yesPool = contractMarket
    ? BigInt((contractMarket as { totalYesBets: bigint }).totalYesBets)
    : BigInt(0);
  const noPool = contractMarket
    ? BigInt((contractMarket as { totalNoBets: bigint }).totalNoBets)
    : BigInt(0);

  const chainCreator = contractMarket
    ? ((contractMarket as { creator: string }).creator as string)
    : null;
  const chainResolutionTime = contractMarket
    ? Number((contractMarket as { resolutionTime: bigint }).resolutionTime)
    : Math.floor(new Date(marketData?.resolution_time || 0).getTime() / 1000);
  const resolvedOnChain = contractMarket
    ? Boolean((contractMarket as { resolved: boolean }).resolved)
    : Boolean(marketData?.resolved);
  const outcomeOnChain = resolvedOnChain
    ? contractMarket
      ? Boolean((contractMarket as { outcome: boolean }).outcome)
      : (marketData?.outcome ?? null)
    : null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const bettingClosed = resolvedOnChain || nowSeconds >= chainResolutionTime;

  const isCreator =
    !!address &&
    !!chainCreator &&
    address.toLowerCase() === chainCreator.toLowerCase();
  const canResolve =
    isCreator && !resolvedOnChain && nowSeconds >= chainResolutionTime;

  const userBetAmount = userBet
    ? BigInt((userBet as { amount: bigint }).amount)
    : BigInt(0);
  const userBetClaimed = userBet
    ? Boolean((userBet as { claimed: boolean }).claimed)
    : false;
  const userBetSide = userBet
    ? Boolean((userBet as { isYes: boolean }).isYes)
      ? "YES"
      : "NO"
    : null;
  const potentialPayout = payoutData ? BigInt(payoutData as bigint) : BigInt(0);

  const canClaim =
    isConnected &&
    resolvedOnChain &&
    potentialPayout > BigInt(0) &&
    !userBetClaimed &&
    userBetAmount > BigInt(0);

  const estimatedPayout = useMemo(() => {
    if (!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0) {
      return "0";
    }

    const betVal = Number(betAmount);
    const yesPoolNum = Number(formatEther(yesPool));
    const noPoolNum = Number(formatEther(noPool));

    const myPool = selectedSide === "YES" ? yesPoolNum : noPoolNum;
    const otherPool = selectedSide === "YES" ? noPoolNum : yesPoolNum;
    const myPoolAfter = myPool + betVal;

    if (myPoolAfter === 0) return betVal.toFixed(2);
    if (otherPool === 0) return betVal.toFixed(2);

    const profit = (betVal * otherPool) / myPoolAfter;
    return (betVal + profit).toFixed(4);
  }, [betAmount, selectedSide, yesPool, noPool]);

  const isBusy = isWritePending || isConfirming;

  function handlePlaceBet(e: React.FormEvent) {
    e.preventDefault();
    if (!marketData || !isConnected || bettingClosed) return;

    setPendingAction("bet");
    setStatus("Please confirm bet transaction in wallet...");

    writeContract(
      {
        address: contractAddress,
        abi: PrivateMarketABI,
        functionName: "placeBet",
        args: [BigInt(marketData.chain_market_id), selectedSide === "YES"],
        value: parseEther(betAmount),
        maxPriorityFeePerGas: minPriorityFeePerGas,
        maxFeePerGas,
      },
      {
        onError: (err) => {
          setPendingAction(null);
          setStatus(`Error: ${err.message}`);
        },
        onSuccess: () =>
          setStatus("Transaction sent. Waiting for confirmation..."),
      },
    );
  }

  function handleResolve(outcome: boolean) {
    if (!marketData || !canResolve) return;

    setPendingAction("resolve");
    setPendingResolutionOutcome(outcome);
    setStatus("Please confirm market resolution in wallet...");

    writeContract(
      {
        address: contractAddress,
        abi: PrivateMarketABI,
        functionName: "resolveMarket",
        args: [BigInt(marketData.chain_market_id), outcome],
        maxPriorityFeePerGas: minPriorityFeePerGas,
        maxFeePerGas,
      },
      {
        onError: (err) => {
          setPendingAction(null);
          setPendingResolutionOutcome(null);
          setStatus(`Error: ${err.message}`);
        },
        onSuccess: () =>
          setStatus("Resolution transaction sent. Waiting for confirmation..."),
      },
    );
  }

  function handleClaim() {
    if (!marketData || !canClaim) return;

    setPendingAction("claim");
    setStatus("Please confirm claim transaction in wallet...");

    writeContract(
      {
        address: contractAddress,
        abi: PrivateMarketABI,
        functionName: "claimWinnings",
        args: [BigInt(marketData.chain_market_id)],
        maxPriorityFeePerGas: minPriorityFeePerGas,
        maxFeePerGas,
      },
      {
        onError: (err) => {
          setPendingAction(null);
          setStatus(`Error: ${err.message}`);
        },
        onSuccess: () =>
          setStatus("Claim transaction sent. Waiting for confirmation..."),
      },
    );
  }

  if (loadingMetadata) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-purple-500" />
      </div>
    );
  }

  if (!marketData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-10">
        Market not found via Supabase ID.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 md:p-12 font-mono">
      <div className="max-w-4xl mx-auto flex justify-between items-center mb-8">
        <button
          type="button"
          className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent"
          onClick={() => router.push("/")}
        >
          Private Polymarket
        </button>
        <ConnectButton />
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            {marketData.image_url ? (
              <Image
                src={marketData.image_url}
                alt="Market"
                width={1200}
                height={384}
                unoptimized
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            ) : (
              <div className="w-full h-32 bg-gray-700 rounded-lg mb-4 flex items-center justify-center text-gray-500">
                <Trophy className="w-10 h-10 opacity-50" />
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4 leading-snug">
              {marketData.question_text}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock3 className="w-4 h-4" />
              <span>
                Resolves:{" "}
                {new Date(marketData.resolution_time).toLocaleString()}
              </span>
            </div>

            <div className="mt-4">
              {resolvedOnChain ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  Resolved: {outcomeOnChain ? "YES" : "NO"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 text-xs">
                  <AlertCircle className="w-3 h-3" />
                  Open
                </span>
              )}
            </div>
          </div>

          <TugOfWar yesPool={yesPool} noPool={noPool} />
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-2xl h-fit space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Coins className="text-yellow-400" />
            Trading
          </h3>

          {!isConnected ? (
            <div className="text-center py-10 bg-gray-700/50 rounded-lg">
              <p className="mb-4 text-gray-300">Connect wallet to trade</p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : bettingClosed && !resolvedOnChain ? (
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
              Betting is closed. Waiting for market creator to resolve outcome.
            </div>
          ) : !resolvedOnChain ? (
            <form onSubmit={handlePlaceBet} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedSide("YES")}
                  className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                    selectedSide === "YES"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-gray-700 border-transparent text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSide("NO")}
                  className={`py-4 rounded-xl font-bold text-lg transition-all border-2 ${
                    selectedSide === "NO"
                      ? "bg-rose-500/20 border-rose-500 text-rose-400"
                      : "bg-gray-700 border-transparent text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  NO
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Amount (MATIC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full pl-4 pr-16 py-4 rounded-xl bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-xl font-mono"
                    placeholder="0.0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                    MATIC
                  </span>
                </div>
              </div>

              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400 text-sm">
                    Estimated Payout
                  </span>
                  <span className="text-emerald-400 font-bold font-mono text-lg">
                    {estimatedPayout} MATIC
                  </span>
                </div>
                {parseFloat(estimatedPayout) === parseFloat(betAmount) &&
                  parseFloat(betAmount) > 0 && (
                    <div className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Refund scenario (no opposing bets yet)</span>
                    </div>
                  )}
              </div>

              <button
                type="submit"
                disabled={isBusy || !betAmount || parseFloat(betAmount) <= 0}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
              >
                {isBusy && pendingAction === "bet" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Bet ${selectedSide}`
                )}
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-lg border border-gray-700 bg-gray-900/50 text-sm text-gray-300">
              Market is resolved. Claim is available for winners.
            </div>
          )}

          {isCreator && !resolvedOnChain && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
              <div className="flex items-center gap-2 text-indigo-300 mb-3">
                <Gavel className="w-4 h-4" />
                <span className="font-semibold">Creator Controls</span>
              </div>
              {canResolve ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResolve(true)}
                    className="py-3 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Resolve YES
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleResolve(false)}
                    className="py-3 rounded-lg font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                  >
                    Resolve NO
                  </button>
                </div>
              ) : (
                <p className="text-xs text-indigo-200/80">
                  You can resolve after{" "}
                  {new Date(chainResolutionTime * 1000).toLocaleString()}.
                </p>
              )}
            </div>
          )}

          {isConnected && resolvedOnChain && (
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-900/60">
              <h4 className="font-semibold mb-2">Your Position</h4>
              {userBetAmount > BigInt(0) ? (
                <div className="space-y-2 text-sm text-gray-300">
                  <div>
                    Bet: {formatEther(userBetAmount)} MATIC on {userBetSide}
                  </div>
                  <div>
                    Potential claim: {formatEther(potentialPayout)} MATIC
                  </div>
                  {canClaim ? (
                    <button
                      type="button"
                      onClick={handleClaim}
                      disabled={isBusy}
                      className="mt-2 w-full py-3 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {isBusy && pendingAction === "claim"
                        ? "Processing..."
                        : "Claim Winnings"}
                    </button>
                  ) : userBetClaimed ? (
                    <div className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Already claimed
                    </div>
                  ) : potentialPayout === BigInt(0) ? (
                    <div className="inline-flex items-center gap-1 text-rose-400">
                      <XCircle className="w-4 h-4" />
                      No claim available (lost side)
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No bets placed from this wallet.
                </p>
              )}
            </div>
          )}

          {(status || loadingContract) && (
            <div
              className={`text-center text-sm ${
                status.includes("Error") || status.includes("Failed")
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {loadingContract ? "Refreshing on-chain state..." : status}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
