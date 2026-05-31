import { jsPDF } from 'jspdf'
import type { Conversation, Message } from '../types'
import { downloadFile } from './downloadFile'

function speakerLabel(role: Message['role']): string {
  return role === 'user' ? 'You' : 'Remi'
}

export function buildExportTxt(messages: Message[]): string {
  return messages
    .map((m) => `${speakerLabel(m.role)}: ${m.content}`)
    .join('\n\n')
}

export function buildExportMd(messages: Message[]): string {
  return messages
    .map((m) => `**${speakerLabel(m.role)}:**\n\n${m.content}`)
    .join('\n\n---\n\n')
}

export function buildExportJson(
  conversation: Conversation | null,
  messages: Message[],
): string {
  const clean = {
    conversation: conversation?.title ?? 'Conversation',
    exported_at: new Date().toISOString(),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      time: m.created_at,
    })),
  }
  return JSON.stringify(clean, null, 2)
}

export function buildExportHtml(
  conversation: Conversation | null,
  messages: Message[],
): string {
  const title = conversation?.title ?? 'Conversation'
  const body = messages
    .map((m) => {
      const who = speakerLabel(m.role)
      const escaped = m.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `<section class="msg"><h3>${who}</h3><p>${escaped.replace(/\n/g, '<br>')}</p><time>${m.created_at}</time></section>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; line-height: 1.5; }
    h1 { font-size: 1.25rem; }
    .msg { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    .msg h3 { margin: 0 0 0.5rem; font-size: 0.875rem; color: #4f46e5; }
    .msg time { font-size: 0.75rem; color: #888; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Exported ${new Date().toLocaleString()}</p>
  ${body}
</body>
</html>`
}

export function buildExportCsv(messages: Message[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = [
    ['role', 'speaker', 'content', 'created_at'].join(','),
    ...messages.map((m) =>
      [m.role, speakerLabel(m.role), m.content, m.created_at]
        .map(escape)
        .join(','),
    ),
  ]
  return rows.join('\n')
}

export function downloadConversationPdf(
  conversation: Conversation | null,
  messages: Message[],
  filename = 'conversation.pdf',
): void {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(conversation?.title || 'Conversation', 20, 20)
  doc.setFontSize(11)
  let y = 35

  messages.forEach((m) => {
    const label = m.role === 'user' ? 'You:' : 'Remi:'
    const lines = doc.splitTextToSize(`${label} ${m.content}`, 170)
    if (y + lines.length * 7 > 280) {
      doc.addPage()
      y = 20
    }
    doc.text(lines, 20, y)
    y += lines.length * 7 + 5
  })

  doc.save(filename)
}

/** Render AI-generated markdown (headings, bullets, lists) into a styled PDF. */
export function downloadMarkdownAsPdf(
  docType: string,
  conversationTitle: string,
  markdownContent: string,
  filename: string,
): void {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(`${docType}: ${conversationTitle}`, 20, 25)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35)

  doc.setDrawColor(200, 200, 200)
  doc.line(20, 40, 190, 40)

  const lines = markdownContent.split('\n')
  let y = 50

  const ensureSpace = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage()
      y = 20
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\*\*/g, '')

    if (line.startsWith('## ')) {
      ensureSpace(10)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text(line.replace('## ', ''), 20, y)
      y += 8
    } else if (line.startsWith('# ')) {
      ensureSpace(12)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text(line.replace('# ', ''), 20, y)
      y += 10
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const bulletText = line.replace(/^[-*] /, '')
      const wrapped = doc.splitTextToSize(`• ${bulletText}`, 160)
      ensureSpace(wrapped.length * 6 + 2)
      doc.text(wrapped, 28, y)
      y += wrapped.length * 6 + 2
    } else if (/^\d+\./.test(line)) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const wrapped = doc.splitTextToSize(line, 160)
      ensureSpace(wrapped.length * 6 + 2)
      doc.text(wrapped, 28, y)
      y += wrapped.length * 6 + 2
    } else if (line.trim() === '') {
      y += 4
    } else {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const wrapped = doc.splitTextToSize(line, 170)
      ensureSpace(wrapped.length * 6 + 3)
      doc.text(wrapped, 20, y)
      y += wrapped.length * 6 + 3
    }
  }

  doc.save(filename)
}

export function exportTxt(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadFile(buildExportTxt(messages), `${base}.txt`, 'text/plain')
}

export function exportMd(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadFile(buildExportMd(messages), `${base}.md`, 'text/markdown')
}

export function exportJson(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadFile(
    buildExportJson(conversation, messages),
    `${base}.json`,
    'application/json',
  )
}

export function exportHtml(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadFile(
    buildExportHtml(conversation, messages),
    `${base}.html`,
    'text/html;charset=utf-8',
  )
}

export function exportCsv(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadFile(buildExportCsv(messages), `${base}.csv`, 'text/csv;charset=utf-8')
}

export function exportPdf(
  conversation: Conversation | null,
  messages: Message[],
): void {
  const base = conversation?.title?.replace(/[^\w.-]+/g, '_') || 'conversation'
  downloadConversationPdf(conversation, messages, `${base}.pdf`)
}
