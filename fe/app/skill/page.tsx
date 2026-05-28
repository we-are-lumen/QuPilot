import fs from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const metadata = {
  title: 'Skill',
};

const mdPath = path.join(process.cwd(), 'public', 'skill.md');

const H = ({ level, children }: { level: 1 | 2 | 3 | 4; children: React.ReactNode }) => {
  const Tag = `h${level}` as const;
  const cls =
    level === 1
      ? 'text-3xl font-bold tracking-tight text-[#1f1b18] mt-2'
      : level === 2
        ? 'text-2xl font-bold text-[#1f1b18] mt-8'
        : level === 3
          ? 'text-xl font-bold text-[#1f1b18] mt-6'
          : 'text-lg font-semibold text-[#1f1b18] mt-4';
  return <Tag className={cls}>{children}</Tag>;
};

export default async function SkillPage() {
  const md = await fs.readFile(mdPath, 'utf-8');

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="bg-white border border-[#f8f4ef] rounded-2xl p-6 md:p-10 shadow-soft">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <H level={1}>{children}</H>,
            h2: ({ children }) => <H level={2}>{children}</H>,
            h3: ({ children }) => <H level={3}>{children}</H>,
            h4: ({ children }) => <H level={4}>{children}</H>,
            p: ({ children }) => <p className="text-base text-[#6b6560] leading-relaxed mt-4">{children}</p>,
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-[#a63420] font-semibold hover:underline break-words"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => <ul className="list-disc pl-6 mt-4 space-y-2 text-[#6b6560]">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-6 mt-4 space-y-2 text-[#6b6560]">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            hr: () => <hr className="my-8 border-[#f8f4ef]" />,
            code: ({ className, children }) => {
              const isBlock = typeof className === 'string' && className.includes('language-');
              if (isBlock) return <code className={className}>{children}</code>;
              return (
                <code className="px-1.5 py-0.5 rounded-md bg-[#f8f4ef] text-[#251916] text-[0.95em]">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="mt-4 p-4 rounded-xl bg-[#251916f2] text-[#ffdad3] overflow-x-auto shadow-inner">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-[#f8f4ef] text-[#251916]">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-[#f8f4ef] px-3 py-2 text-left font-bold">{children}</th>
            ),
            td: ({ children }) => <td className="border border-[#f8f4ef] px-3 py-2 align-top">{children}</td>,
            blockquote: ({ children }) => (
              <blockquote className="mt-4 border-l-4 border-[#dfbfb9] pl-4 text-[#6b6560] italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {md}
        </ReactMarkdown>
      </div>
    </main>
  );
}

