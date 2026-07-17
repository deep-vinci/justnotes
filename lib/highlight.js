const JS_KEYWORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "export", "extends", "finally", "for", "function",
  "if", "import", "in", "instanceof", "let", "new", "return", "super", "switch",
  "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield",
  "async", "await", "static", "get", "set", "of", "null", "true", "false", "undefined",
]);

const JS_LANGS = new Set(["js", "javascript", "jsx", "ts", "typescript", "tsx", "mjs", "cjs"]);

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TOKEN_PATTERN =
  /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\b\d+\.?\d*\b)|(\b[A-Za-z_$][\w$]*\b)/g;

function highlightJs(code) {
  return escapeHtml(code).replace(
    TOKEN_PATTERN,
    (match, comment1, comment2, template, dquote, squote, number, word) => {
      if (comment1 || comment2) return `<span class="tok-comment">${match}</span>`;
      if (template || dquote || squote) return `<span class="tok-string">${match}</span>`;
      if (number) return `<span class="tok-number">${match}</span>`;
      if (word && JS_KEYWORDS.has(word)) return `<span class="tok-keyword">${match}</span>`;
      return match;
    }
  );
}

const FENCE_PATTERN = /```([a-zA-Z]*)\n([\s\S]*?)```/g;

export function highlightContent(text) {
  let result = "";
  let lastIndex = 0;
  let match;

  FENCE_PATTERN.lastIndex = 0;
  while ((match = FENCE_PATTERN.exec(text)) !== null) {
    const [full, lang, code] = match;
    result += escapeHtml(text.slice(lastIndex, match.index));

    const body = JS_LANGS.has(lang.toLowerCase()) ? highlightJs(code) : escapeHtml(code);
    result += `<span class="code-fence">\`\`\`${escapeHtml(lang)}\n${body}\`\`\`</span>`;

    lastIndex = match.index + full.length;
  }
  result += escapeHtml(text.slice(lastIndex));

  return result + "\n";
}
