import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface RichContentRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

const sanitizeConfig: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'span', 'div'
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'src', 'alt', 'width', 'height',
    'colspan', 'rowspan', 'align'
  ],
  ALLOW_DATA_ATTR: false
};

export const RichContentRenderer: React.FC<RichContentRendererProps> = ({
  content,
  className = '',
  inline = false
}) => {
  const sanitizedContent = useMemo(() => {
    if (!content) return '';

    const isPlainText = !content.includes('<') && !content.includes('>');
    if (isPlainText) {
      const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      return escaped;
    }

    return DOMPurify.sanitize(content, sanitizeConfig);
  }, [content]);

  if (!content) {
    return null;
  }

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      style={contentStyles}
    />
  );
};

const contentStyles: React.CSSProperties = {};

export const RichContentStyles = () => (
  <style>{`
    .rich-content {
      word-break: break-word;
    }
    .rich-content p {
      margin: 0.25rem 0;
    }
    .rich-content p:first-child {
      margin-top: 0;
    }
    .rich-content p:last-child {
      margin-bottom: 0;
    }
    .rich-content img {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      margin: 0.5rem 0;
    }
    .rich-content table {
      border-collapse: collapse;
      margin: 0.5rem 0;
      width: 100%;
    }
    .rich-content th,
    .rich-content td {
      border: 1px solid #cbd5e1;
      padding: 0.5rem;
      text-align: left;
    }
    .rich-content th {
      background-color: #f1f5f9;
      font-weight: 600;
    }
    .rich-content blockquote {
      border-left: 3px solid #cbd5e1;
      padding-left: 1rem;
      margin: 0.5rem 0;
      color: #64748b;
    }
    .rich-content pre {
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-family: monospace;
      font-size: 0.875rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    .rich-content code {
      background-color: #f1f5f9;
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.875em;
    }
    .rich-content pre code {
      background-color: transparent;
      padding: 0;
    }
    .rich-content hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 1rem 0;
    }
    .rich-content ul,
    .rich-content ol {
      padding-left: 1.5rem;
      margin: 0.5rem 0;
    }
    .rich-content li {
      margin: 0.25rem 0;
    }
    .rich-content strong,
    .rich-content b {
      font-weight: 600;
    }
    .rich-content em,
    .rich-content i {
      font-style: italic;
    }
    .rich-content u {
      text-decoration: underline;
    }
    .rich-content s,
    .rich-content strike {
      text-decoration: line-through;
    }
  `}</style>
);

export default RichContentRenderer;
