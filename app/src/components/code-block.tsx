import { useEffect, useState } from "react";
import {
  createHighlighterCore,
  type HighlighterCore,
} from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import("shiki/themes/github-light.mjs"),
        import("shiki/themes/github-dark.mjs"),
      ],
      langs: [import("shiki/langs/move.mjs")],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    });
  }
  return highlighterPromise;
}

export function CodeBlock({ code }: { code: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      setHtml(
        hl.codeToHtml(code, {
          lang: "move",
          themes: { light: "github-light", dark: "github-dark" },
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!html) {
    return (
      <pre className="p-4 text-sm leading-relaxed font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="p-4 text-sm leading-relaxed [&_pre]:!bg-transparent [&_code]:font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
