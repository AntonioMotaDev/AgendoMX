import type { ReactNode } from "react";
import { parseInline, parseMarkdown, type Block, type Inline } from "@/lib/markdown";

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.t) {
      case "text":
        return node.text;
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "code":
        return (
          <code key={index} className="rounded bg-ink/5 px-1 py-0.5 text-[0.9em]">
            {node.text}
          </code>
        );
      case "link": {
        const external = /^https?:\/\//i.test(node.href);
        return (
          <a key={index} href={node.href} className="font-medium text-brand-ink underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {renderInline(node.children)}
          </a>
        );
      }
    }
  });
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.t) {
    case "h": {
      const className = block.level === 1 ? "mt-2 text-2xl font-bold tracking-tight text-ink" : block.level === 2 ? "mt-8 text-lg font-semibold text-ink" : "mt-5 text-base font-semibold text-ink";
      const Tag = (`h${block.level}` as "h1" | "h2" | "h3" | "h4");
      return (
        <Tag key={key} className={className}>
          {renderInline(block.inline)}
        </Tag>
      );
    }
    case "p":
      return (
        <p key={key} className="text-base leading-relaxed text-ink">
          {renderInline(block.inline)}
        </p>
      );
    case "quote":
      return (
        <div key={key} className="flex flex-col gap-2 rounded-lg border-l-4 border-brand bg-surface p-4 text-ink-muted">
          {block.blocks.map(renderBlock)}
        </div>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc space-y-1.5 pl-6 text-base leading-relaxed text-ink">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal space-y-1.5 pl-6 text-base leading-relaxed text-ink">
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div key={key} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper">
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} scope="col" className="px-3 py-2 font-semibold text-ink">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t border-line align-top">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 text-ink">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={key} className="border-line" />;
  }
}

/** One line of markdown (bold, code, links) as inline content, for short notices inside forms. */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>;
}

/** Renders one of the legal markdown texts as a readable page body. */
export function LegalDocument({ markdown }: { markdown: string }) {
  return <article className="flex flex-col gap-4">{parseMarkdown(markdown).map(renderBlock)}</article>;
}
