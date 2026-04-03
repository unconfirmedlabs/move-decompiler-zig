import type { MoveModule } from "./sui";

interface CachedResult {
  packageId: string;
  network: string;
  modules: MoveModule[];
}

let cached: CachedResult | null = null;

export function setCachedModules(packageId: string, network: string, modules: MoveModule[]) {
  cached = { packageId, network, modules };
}

export function getCachedModules(packageId: string, network: string): MoveModule[] | null {
  if (cached && cached.packageId === packageId && cached.network === network) {
    const result = cached.modules;
    cached = null; // consume once
    return result;
  }
  return null;
}
