import React from "react";
import { TrendingUp } from "lucide-react";
import { formatEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type TugOfWarProps = {
  yesPool: bigint;
  noPool: bigint;
};

export const TugOfWar = ({ yesPool, noPool }: TugOfWarProps) => {
  const totalPool = yesPool + noPool;
  const yesPercent =
    totalPool > BigInt(0) ? Number((yesPool * BigInt(100)) / totalPool) : 50;
  const noPercent = 100 - yesPercent;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base tracking-[0.3em] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--color-Buy)]" />
          Market Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-4">
        <div className="relative h-12 overflow-hidden flex font-bold text-xs uppercase tracking-[0.2em]">
          <div
            className="bg-[var(--color-Buy)] text-[var(--color-RedGreenBgText)] flex items-center justify-start px-4 transition-all duration-500 ease-out"
            style={{ width: `${yesPercent}%` }}
          >
            {yesPercent > 10 && `YES ${yesPercent}%`}
          </div>
          <div className="bg-[var(--color-Sell)] text-[var(--color-RedGreenBgText)] flex items-center justify-end px-4 transition-all duration-500 ease-out flex-1">
            {noPercent > 10 && `${noPercent}% NO`}
          </div>
        </div>

        <div className="flex justify-between mt-3 text-sm text-[var(--color-SecondaryText)]">
          <div>Pool: {formatEther(yesPool)} ETH</div>
          <div>Pool: {formatEther(noPool)} ETH</div>
        </div>
      </CardContent>
    </Card>
  );
};
