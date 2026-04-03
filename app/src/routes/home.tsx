import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { decompile } from "@/lib/decompiler";
import { validatePackage } from "@/lib/sui";
import { getStoredNetwork } from "@/lib/network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
// Button still used in file result view
import { CodeBlock } from "@/components/code-block";

interface DecompiledModule {
  name: string;
  source: string;
  inputBytes: number;
}

export function HomePage() {
  const [packageId, setPackageId] = useState("");
  const [network, setNetwork] = useState(getStoredNetwork());

  // Sync with header network selector
  useEffect(() => {
    const handler = (e: Event) => {
      setNetwork((e as CustomEvent).detail);
      setIsPackage(null);
    };
    window.addEventListener("network-change", handler);
    return () => window.removeEventListener("network-change", handler);
  }, []);
  const [isPackage, setIsPackage] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [fileModules, setFileModules] = useState<DecompiledModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Validate package ID in background
  useEffect(() => {
    const id = packageId.trim();
    if (!id || !/^0x[0-9a-fA-F]{64}$/.test(id)) {
      setIsPackage(null);
      return;
    }

    setValidating(true);
    setIsPackage(null);
    const controller = new AbortController();

    validatePackage(id, network, controller.signal)
      .then((ok) => {
        if (!controller.signal.aborted) {
          setIsPackage(ok);
          setValidating(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsPackage(false);
          setValidating(false);
        }
      });

    return () => controller.abort();
  }, [packageId, network]);

  const handleFileDecompile = useCallback(
    async (bytes: Uint8Array, name: string) => {
      setLoading(true);
      setError("");
      setFileModules([]);
      try {
        const start = performance.now();
        const source = await decompile(bytes);
        setTimeMs(Math.round(performance.now() - start));
        setFileModules([
          { name: name.replace(/\.mv$/, ""), source, inputBytes: bytes.length },
        ]);
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
      reader.onload = () =>
        handleFileDecompile(
          new Uint8Array(reader.result as ArrayBuffer),
          file.name
        );
      reader.readAsArrayBuffer(file);
    },
    [handleFileDecompile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
        handleFileDecompile(
          new Uint8Array(reader.result as ArrayBuffer),
          file.name
        );
      reader.readAsArrayBuffer(file);
    },
    [handleFileDecompile]
  );

  const current = fileModules[0];

  if (current) {
    return (
      <main className="flex flex-1 gap-4 p-4 overflow-hidden">
        <Card className="flex flex-1 flex-col min-w-0 rounded-2xl overflow-hidden">
          <div className="shrink-0 flex items-center justify-between border-b px-5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium font-mono truncate">
                {current.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {current.inputBytes.toLocaleString()} bytes →{" "}
                {current.source.split("\n").length} lines
                {timeMs > 0 && ` · ${timeMs}ms`}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFileModules([]);
                  setError("");
                }}
              >
                New
              </Button>
            </div>
          </div>
          <CardContent className="flex-1 overflow-auto p-0">
            <CodeBlock code={current.source} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const looksLikeId = /^0x[0-9a-fA-F]{64}$/.test(packageId.trim());

  const [validated, setValidated] = useState(false);

  // Auto-navigate when package is validated (with brief glow)
  useEffect(() => {
    if (!isPackage) {
      setValidated(false);
      return;
    }
    setValidated(true);
    const timer = setTimeout(() => {
      navigate({
        to: "/d/$packageId",
        params: { packageId: packageId.trim() },
        search: { network: network !== "mainnet" ? network : undefined },
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [isPackage, packageId, network, navigate]);

  return (
    <main
      className="flex flex-1 overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Input
            type="text"
            value={packageId}
            onChange={(e) => {
              setPackageId(e.target.value);
              setError("");
            }}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
            className={`w-[66ch] box-content h-auto px-5 py-3 font-mono transition-shadow duration-500 ${validated ? "ring-2 ring-primary/60 shadow-[0_0_20px_rgba(99,102,241,0.3)]" : ""}`}
          />

          <div className="h-5 text-muted-foreground text-center">
            {validated && <span />}
            {!validated && looksLikeId && isPackage === false && !validating && (
              <span className="text-destructive">Not a package on {network}</span>
            )}
            {!validated && !looksLikeId && packageId.trim().length > 0 && (
              <span className="text-destructive">
                Invalid — expected 0x followed by 64 hex characters
              </span>
            )}
            {!packageId.trim() && !loading && !error && (
              <span>
                Or{" "}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  upload a .mv file
                </button>
                {" "}/ drag it anywhere on this page
              </span>
            )}
            {loading && (
              <span className="animate-pulse">Decompiling…</span>
            )}
            {error && (
              <span className="text-destructive">{error}</span>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".mv"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </main>
  );
}
