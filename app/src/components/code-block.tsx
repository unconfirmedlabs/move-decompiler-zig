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

function highlight(code: string): string {
  // Escape HTML
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply highlights with markers to avoid double-matching
  // Order matters: comments first, then strings, then keywords
  html = html.replace(COMMENTS, '<span class="mv-comment">$1</span>');
  html = html.replace(STRINGS, '<span class="mv-string">$1</span>');
  html = html.replace(KEYWORDS, '<span class="mv-keyword">$1</span>');
  html = html.replace(TYPES, '<span class="mv-type">$1</span>');
  html = html.replace(ABILITIES, '<span class="mv-ability">$1</span>');
  html = html.replace(LITERALS, (match) => {
    // Don't highlight if already inside a span
    return `<span class="mv-literal">${match}</span>`;
  });

  return html;
}

export function CodeBlock({ code }: { code: string }) {
  const html = useMemo(() => highlight(code), [code]);

  return (
    <pre className="p-4 text-sm leading-relaxed font-mono whitespace-pre">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
