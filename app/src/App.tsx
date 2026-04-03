import { useState, useCallback, useRef } from "react";
import { decompile } from "@/lib/decompiler";
import { fetchPackageModules, type MoveModule } from "@/lib/sui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DecompiledModule {
  name: string;
  source: string;
  inputBytes: number;
}

export function App() {
  const [modules, setModules] = useState<DecompiledModule[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const [packageId, setPackageId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const decompileModules = useCallback(
    async (mods: MoveModule[], label: string) => {
      setLoading(true);
      setError("");
      setModules([]);
      setSelected(0);
      setLabel(label);
      try {
        const start = performance.now();
        const results: DecompiledModule[] = [];
        for (const mod of mods) {
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
        setError(e instanceof Error ? e.message : "Decompilation failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        decompileModules(
          [{ name: file.name.replace(/\.mv$/, ""), bytes }],
          file.name
        );
      };
      reader.readAsArrayBuffer(file);
    },
    [decompileModules]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        decompileModules(
          [{ name: file.name.replace(/\.mv$/, ""), bytes }],
          file.name
        );
      };
      reader.readAsArrayBuffer(file);
    },
    [decompileModules]
  );

  const handleFetchPackage = useCallback(async () => {
    const id = packageId.trim();
    if (!id || !id.startsWith("0x")) {
      setError("Enter a valid Sui package ID (0x...)");
      return;
    }
    setLoading(true);
    setError("");
    setModules([]);
    setLabel(id.slice(0, 10) + "…");
    try {
      const mods = await fetchPackageModules(id);
      await decompileModules(mods, id.slice(0, 10) + "…" + ` (${mods.length} modules)`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch package");
      setLoading(false);
    }
  }, [packageId, decompileModules]);

  const reset = useCallback(() => {
    setModules([]);
    setError("");
    setLabel("");
    setPackageId("");
    setSelected(0);
  }, []);

  const current = modules[selected];
  const hasOutput = modules.length > 0;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Move Decompiler
            </h1>
            <Badge variant="secondary" className="font-mono text-[10px]">
              WASM
            </Badge>
          </div>
          <a
            href="https://github.com/unconfirmedlabs/move-decompiler-zig"
            target="_blank"
            rel="noopener"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-6">
        <div className="mx-auto w-full max-w-7xl flex flex-1 flex-col gap-4">
          {/* Input screen */}
          {!hasOutput && !loading && !error && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              {/* Package ID input */}
              <div className="w-full max-w-lg">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetchPackage()}
                    placeholder="Sui package ID (0x...)"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button onClick={handleFetchPackage} disabled={!packageId.trim()}>
                    Decompile
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px w-8 bg-border" />
                or
                <span className="h-px w-8 bg-border" />
              </div>

              {/* File drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="w-full max-w-lg cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-foreground/25"
              >
                <p className="text-sm font-medium">Drop a .mv file</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to choose
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".mv"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Runs entirely in your browser — no server, no uploads
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground animate-pulse">
                Decompiling {label}...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 max-w-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                Try again
              </Button>
            </div>
          )}

          {/* Output */}
          {hasOutput && current && (
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Module tabs */}
                  {modules.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto">
                      {modules.map((m, i) => (
                        <button
                          key={m.name}
                          onClick={() => setSelected(i)}
                          className={`rounded-md px-2.5 py-1 text-xs font-mono transition-colors ${
                            i === selected
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {modules.length === 1 && (
                    <span className="text-sm font-medium font-mono">
                      {current.name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {current.inputBytes.toLocaleString()} bytes →{" "}
                    {current.source.split("\n").length} lines
                    {modules.length > 1 && ` · ${modules.length} modules`}
                    {timeMs > 0 && ` · ${timeMs}ms`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(current.source)}
                  >
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset}>
                    New
                  </Button>
                </div>
              </div>
              <div className="relative flex-1 overflow-auto rounded-lg border bg-muted/30">
                <pre className="p-4 text-sm leading-relaxed font-mono whitespace-pre overflow-x-auto">
                  <code>{current.source}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
          <span>Client-side only. No bytecode leaves your browser.</span>
          <span>Built with Zig + WASM</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
