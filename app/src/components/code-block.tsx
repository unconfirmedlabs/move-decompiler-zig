import { useMemo } from "react";

const KEYWORDS =
  /\b(module|use|struct|enum|fun|public|friend|entry|native|let|mut|if|else|while|loop|break|continue|return|abort|match|has|phantom|const|as)\b/g;
const TYPES =
  /\b(bool|u8|u16|u32|u64|u128|u256|address|signer|vector)\b/g;
const ABILITIES = /\b(copy|drop|store|key)\b/g;
const LITERALS =
  /\b(true|false|0x[0-9a-fA-F]+|\d+u(?:8|16|32|64|128|256)|\d+)\b/g;
const STRINGS = /(b"[^"]*"|x"[^"]*")/g;
const COMMENTS = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;

function highlightLine(line: string): string {
  let html = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(COMMENTS, '<span class="mv-comment">$1</span>');
  html = html.replace(STRINGS, '<span class="mv-string">$1</span>');
  html = html.replace(KEYWORDS, '<span class="mv-keyword">$1</span>');
  html = html.replace(TYPES, '<span class="mv-type">$1</span>');
  html = html.replace(ABILITIES, '<span class="mv-ability">$1</span>');
  html = html.replace(LITERALS, (match) => {
    return `<span class="mv-literal">${match}</span>`;
  });

  return html;
}

export function CodeBlock({ code }: { code: string }) {
  const lines = useMemo(() => {
    return code.split("\n").map((line) => highlightLine(line));
  }, [code]);

  const gutterWidth = String(lines.length).length;

  return (
    <pre className="p-4 leading-relaxed font-mono whitespace-pre">
      <code>
        {lines.map((html, i) => (
          <div key={i} className="flex">
            <span
              className="select-none text-muted-foreground/40 text-right pr-4 shrink-0"
              style={{ width: `${gutterWidth + 1}ch` }}
            >
              {i + 1}
            </span>
            <span dangerouslySetInnerHTML={{ __html: html || "\n" }} />
          </div>
        ))}
      </code>
    </pre>
  );
}
