import { Link } from "@tanstack/react-router";
import type { Network } from "@/lib/sui";
import { getStoredNetwork, setStoredNetwork } from "@/lib/network";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NETWORKS: Network[] = ["mainnet", "testnet", "devnet", "localnet"];

export function Header() {
  const [network, setNetworkState] = useState<Network>(getStoredNetwork());

  const setNetwork = (n: Network) => {
    setNetworkState(n);
    setStoredNetwork(n);
    window.dispatchEvent(new CustomEvent("network-change", { detail: n }));
  };

  return (
    <header className="shrink-0 border-b px-6 py-4">
      <div className="mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            className="size-6 rounded-md"
          >
            <rect
              width="32"
              height="32"
              fill="currentColor"
              className="text-foreground"
            />
            <circle cx="8" cy="16" r="3.5" className="fill-background" />
            <circle cx="16" cy="16" r="3.5" className="fill-background" />
            <circle cx="24" cy="16" r="3.5" className="fill-background" />
          </svg>
          <h1 className="text-lg font-semibold tracking-tight">
            Move Decompiler
          </h1>
        </Link>
        <Select value={network} onValueChange={(v) => setNetwork(v as Network)}>
          <SelectTrigger className="w-36 rounded-3xl font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NETWORKS.map((n) => (
              <SelectItem key={n} value={n} className="font-mono">
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
