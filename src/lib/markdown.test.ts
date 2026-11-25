import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./markdown";

describe("safeHref", () => {
  it("allows web, mail and same-site links only", () => {
    expect(safeHref("https://agendomx.com/x")).toBe("https://agendomx.com/x");
    expect(safeHref("mailto:a@b.mx")).toBe("mailto:a@b.mx");
    expect(safeHref("/privacidad")).toBe("/privacidad");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "ftp://x", "vbscript:x", ""]) expect(safeHref(bad)).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses bold, code and links", () => {
    expect(parseInline("a **b** `c` [d](/e) f")).toEqual([
      { t: "text", text: "a " },
      { t: "strong", children: [{ t: "text", text: "b" }] },
      { t: "text", text: " " },
      { t: "code", text: "c" },
      { t: "text", text: " " },
      { t: "link", href: "/e", children: [{ t: "text", text: "d" }] },
      { t: "text", text: " f" },
    ]);
  });
  it("turns an unsafe link into its plain label and keeps stray markers as text", () => {
    const unsafe = parseInline("[clic](javascript:alert(1))");
    expect(unsafe.some((n) => n.t === "link")).toBe(false);
    expect(unsafe[0]).toEqual({ t: "text", text: "clic" });
    expect(parseInline("2 ** 3 and a [lonely bracket")).toEqual([{ t: "text", text: "2 ** 3 and a [lonely bracket" }]);
  });
  it("never produces raw HTML: tags stay literal text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([{ t: "text", text: "<script>alert(1)</script>" }]);
  });
});

describe("parseMarkdown", () => {
  it("parses headings, paragraphs (joined across lines), rules and quotes", () => {
    const blocks = parseMarkdown("# Título\n\nUna línea\ny otra.\n\n---\n\n> cita **fuerte**\n> segunda");
    expect(blocks.map((b) => b.t)).toEqual(["h", "p", "hr", "quote"]);
    expect(blocks[1]).toMatchObject({ t: "p", inline: [{ t: "text", text: "Una línea y otra." }] });
    expect(blocks[3]).toMatchObject({ t: "quote", blocks: [{ t: "p" }] });
  });
  it("parses bullet and numbered lists with wrapped lines", () => {
    const blocks = parseMarkdown("- uno\n- dos\n  sigue\n\n1. a\n2. b");
    expect(blocks[0]).toMatchObject({ t: "ul" });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ t: "ol" });
  });
  it("parses tables", () => {
    const [table] = parseMarkdown("| A | B |\n|---|---|\n| 1 | **2** |\n| 3 | 4 |");
    expect(table).toMatchObject({ t: "table" });
    expect((table as { rows: unknown[] }).rows).toHaveLength(2);
  });
  it("terminates on any input, including odd shapes", () => {
    for (const odd of ["", "\n\n", "|", "|a|\n", "> ", "- ", "1.", "#", "# ", "---", "\u0000"]) expect(() => parseMarkdown(odd)).not.toThrow();
  });
});
