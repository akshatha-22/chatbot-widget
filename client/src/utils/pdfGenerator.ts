import { jsPDF } from 'jspdf'

export const generatePDFFromContent = async (
  markdown: string,
  filename: string,
): Promise<void> => {
  const doc = new jsPDF()
  const lines = markdown.split('\n')
  let y = 20

  lines.forEach((line) => {
    if (y > 270) {
      doc.addPage()
      y = 20
    }

    const stripped = line.replace(/\*\*/g, '')

    if (stripped.startsWith('## ')) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      y += 4
      doc.text(stripped.replace('## ', ''), 20, y)
      y += 9
    } else if (stripped.startsWith('# ')) {
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 15, 15)
      doc.text(stripped.replace('# ', ''), 20, y)
      y += 12
    } else if (stripped.startsWith('- ') || stripped.startsWith('* ')) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const text = '• ' + stripped.replace(/^[-*] /, '')
      const wrapped = doc.splitTextToSize(text, 160)
      doc.text(wrapped, 26, y)
      y += wrapped.length * 6 + 2
    } else if (/^\d+\./.test(stripped)) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      const wrapped = doc.splitTextToSize(stripped, 160)
      doc.text(wrapped, 26, y)
      y += wrapped.length * 6 + 2
    } else if (stripped.trim() === '') {
      y += 3
    } else {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(70, 70, 70)
      const wrapped = doc.splitTextToSize(stripped, 170)
      doc.text(wrapped, 20, y)
      y += wrapped.length * 6 + 3
    }
  })

  doc.save(filename)
}
