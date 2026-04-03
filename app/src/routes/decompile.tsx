import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { decompile } from "@/lib/decompiler";
import { fetchPackageModules, type Network } from "@/lib/sui";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";

interface DecompiledModule {
  name: string;
  source: string;
  inputBytes: number;
}

export function DecompilePage() {
  const { packageId, network } = useParams({ from: "/decompile/$network/$packageId" });
  const [modules, setModules] = useState<DecompiledModule[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [timeMs, setTimeMs] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");
      setModules([]);
      setSelected(0);

      try {
        const mods = await fetchPackageModules(packageId, network as Network);
        if (cancelled) return;

        const start = performance.now();
        const results: DecompiledModule[] = [];
        for (const mod of mods) {
          if (cancelled) return;
          const source = await decompile(mod.bytes);
          results.push({
            name: mod.name,
            source,
            inputBytes: mod.bytes.length,
          });
        }
        setTimeMs(Math.round(performance.now() - start));
        setModules(results);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Decompilation failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [packageId, network]);

  const current = modules[selected];
  const shortId = packageId.slice(0, 10) + "…" + packageId.slice(-4);

  const copyAll = useCallback(() => {
    const all = modules.map((m) => m.source).join("\n\n");
    navigator.clipboard.writeText(all);
  }, [modules]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground animate-pulse">
          Fetching and decompiling {shortId}...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 max-w-md">
          <p className="text-destructive">{error}</p>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm">
            Back
          </Button>
        </Link>
      </main>
    );
  }

  if (!current) return null;

  return (
    <main className="flex flex-1 overflow-hidden">
      {/* Left sidebar */}
      {modules.length > 1 && (
        <aside className="shrink-0 w-52 border-r overflow-y-auto">
          <div className="p-3">
            <nav className="flex flex-col gap-0.5">
              {modules.map((m, i) => (
                <button
                  key={m.name}
                  onClick={() => setSelected(i)}
                  className={`rounded-md px-2.5 py-1.5 text-left font-mono transition-colors ${
                    i === selected
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Code pane */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="shrink-0 flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium font-mono truncate">
              {current.name}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {current.inputBytes.toLocaleString()} bytes →{" "}
              {current.source.split("\n").length} lines
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigator.clipboard.writeText(current.source)}
            >
              Copy
            </Button>
            {modules.length > 1 && (
              <Button variant="outline" size="sm" onClick={copyAll}>
                Copy all
              </Button>
            )}
            <Link to="/">
              <Button variant="outline" size="sm">
                New
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <CodeBlock code={current.source} />
        </div>
      </div>
    </main>
  );
}
