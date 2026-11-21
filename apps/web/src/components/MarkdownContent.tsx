import React from 'react';

function renderInlineFormatting(text: string): React.ReactNode[] {
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[var(--text-main)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded-md bg-[#FFF0F5] px-1.5 py-0.5 font-mono text-xs font-semibold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = href.startsWith('http') && !href.includes('kadinatlasi.com');
      return (
        <a
          key={idx}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="font-bold text-[#7C3AED] underline decoration-purple-300 underline-offset-2 hover:text-[#E91E63]"
        >
          {label}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string; sectionIndex?: number }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'p'; text: string };

export function extractMarkdownHeadings(content: string): Array<{ id: string; text: string }> {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const headings: Array<{ id: string; text: string }> = [];
  let sectionIndex = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      sectionIndex += 1;
      headings.push({
        id: `section-${sectionIndex}`,
        text: line.slice(3).trim().replace(/\*\*/g, ''),
      });
    }
  }
  return headings;
}

function parseMarkdownBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let sectionIndex = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      sectionIndex += 1;
      blocks.push({ type: 'h2', text: line.slice(3).trim(), sectionIndex });
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith('- ') || cur.startsWith('* ')) {
          items.push(cur.slice(2).trim());
          i += 1;
        } else {
          break;
        }
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const match = cur.match(/^\d+\.\s+(.*)$/);
        if (match) {
          items.push(match[1].trim());
          i += 1;
        } else {
          break;
        }
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith('# ') ||
        next.startsWith('## ') ||
        next.startsWith('### ') ||
        next.startsWith('- ') ||
        next.startsWith('* ') ||
        /^\d+\.\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    blocks.push({ type: 'p', text: paragraphLines.join(' ') });
  }

  return blocks;
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content || '');

  return (
    <div className="space-y-4 text-base leading-relaxed text-[var(--text-main)]">
      {blocks.map((block, idx) => {
        if (block.type === 'h1') {
          return (
            <h2
              key={idx}
              className="pt-2 text-2xl font-extrabold tracking-tight text-[var(--text-main)]"
            >
              {renderInlineFormatting(block.text)}
            </h2>
          );
        }
        if (block.type === 'h2') {
          return (
            <h3
              key={idx}
              id={block.sectionIndex ? `section-${block.sectionIndex}` : undefined}
              className="scroll-mt-24 border-b border-[var(--border-soft)] pb-2 pt-5 text-xl font-extrabold tracking-tight text-[var(--text-main)]"
            >
              {renderInlineFormatting(block.text)}
            </h3>
          );
        }
        if (block.type === 'h3') {
          return (
            <h4
              key={idx}
              className="pt-3 text-lg font-bold text-[#7C3AED] dark:text-[#c4b5fd]"
            >
              {renderInlineFormatting(block.text)}
            </h4>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={idx} className="space-y-2 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF69B4]" />
                  <span className="text-[var(--text-main)]">{renderInlineFormatting(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={idx} className="space-y-2 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-xs font-extrabold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
                    {j + 1}
                  </span>
                  <span className="text-[var(--text-main)]">{renderInlineFormatting(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === 'p') {
          return (
            <p key={idx} className="leading-7 text-[var(--text-main)]">
              {renderInlineFormatting(block.text)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
