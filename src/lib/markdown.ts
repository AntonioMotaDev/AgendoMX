/**
 * A deliberately small markdown parser for the legal texts (docs/legal/*.md): headings,
 * paragraphs, blockquotes, bullet/numbered lists, tables, rules, **bold**, `code` and links.
 * It produces plain data (no HTML), so rendering can never inject markup.
 */
export type Inline = { t: "text"; text: string } | { t: "strong"; children: Inline[] } | { t: "code"; text: string } | { t: "link"; href: string; children: Inline[] };

export type Block =
  | { t: "h"; level: 1 | 2 | 3 | 4; inline: Inline[] }
  | { t: "p"; inline: Inline[] }
  | { t: "quote"; blocks: Block[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "table"; header: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

/** Only web, mail and same-site links are allowed; anything else (javascript:, data:…) stays plain text. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", text });
    text = "";
  };
  let i = 0;
  while (i < source.length) {
    if (source.startsWith("**", i)) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (source[i] === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (source[i] === "[") {
      const close = source.indexOf("]", i + 1);
      if (close > i && source[close + 1] === "(") {
        const paren = source.indexOf(")", close + 2);
        if (paren > close) {
          const href = safeHref(source.slice(close + 2, paren));
          const label = source.slice(i + 1, close);
          flush();
          if (href) out.push({ t: "link", href, children: parseInline(label) });
          else out.push({ t: "text", text: label });
          i = paren + 1;
          continue;
        }
      }
    }
    text += source[i];
    i++;
  }
  flush();
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const isTableSeparator = (line: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ t: "h", level: heading[1]!.length as 1 | 2 | 3 | 4, inline: parseInline(heading[2]!.trim()) });
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) quoted.push(lines[i++]!.replace(/^>\s?/, ""));
      blocks.push({ t: "quote", blocks: parseMarkdown(quoted.join("\n")) });
      continue;
    }

    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]!)) {
      const header = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(splitRow(lines[i++]!).map(parseInline));
      blocks.push({ t: "table", header, rows });
      continue;
    }

    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: Inline[][] = [];
      while (i < lines.length && marker.test(lines[i]!)) {
        let item = lines[i]!.replace(marker, "");
        i++;
        // A wrapped continuation line (indented, not a new item) belongs to the same item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]!) && !bullet.test(lines[i]!) && !numbered.test(lines[i]!)) item += ` ${lines[i++]!.trim()}`;
        items.push(parseInline(item.trim()));
      }
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,4}\s|>|---+\s*$)/.test(lines[i]!) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]!) && !lines[i]!.trim().startsWith("|")) {
      paragraph.push(lines[i++]!.trim());
    }
    if (paragraph.length === 0) {
      // Unreachable shape guard: never loop forever on an unexpected line.
      paragraph.push(lines[i++]!.trim());
    }
    blocks.push({ t: "p", inline: parseInline(paragraph.join(" ")) });
  }
  return blocks;
}
