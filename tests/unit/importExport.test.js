import { describe, it, expect } from 'vitest';

describe('Script File Import Logic', () => {
  it('correctly parses markdown blocks into semantic HTML', () => {
    const rawMarkdown = `# My Great Speech\n\nThis is paragraph one with **bold** words.\n\n## Section Two\n\nAnother paragraph with *italic* emphasis.`;
    
    const blocks = rawMarkdown
      .split(/(?:\r?\n){2,}/)
      .map(block => {
        let b = block.trim();
        if (b.startsWith('### ')) return `<h3>${b.slice(4)}</h3>`;
        if (b.startsWith('## ')) return `<h2>${b.slice(3)}</h2>`;
        if (b.startsWith('# ')) return `<h1>${b.slice(2)}</h1>`;
        b = b.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        b = b.replace(/\*(.*?)\*/g, '<em>$1</em>');
        return `<p>${b.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');

    expect(blocks).toContain('<h1>My Great Speech</h1>');
    expect(blocks).toContain('<strong>bold</strong>');
    expect(blocks).toContain('<h2>Section Two</h2>');
    expect(blocks).toContain('<em>italic</em>');
  });

  it('correctly wraps plain text blocks into paragraphs', () => {
    const rawText = `Line 1 text\n\nLine 2 text`;
    const blocks = rawText
      .split(/(?:\r?\n){2,}/)
      .map(para => `<p>${para.trim().replace(/\n/g, '<br>')}</p>`)
      .join('\n');

    expect(blocks).toBe('<p>Line 1 text</p>\n<p>Line 2 text</p>');
  });

  it('generates genuine DOCX binary and mammoth imports it back', async () => {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx');
    const mammoth = (await import('mammoth')).default;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Speech for Event', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun({ text: 'This has ' }),
              new TextRun({ text: 'bold emphasis', bold: true })
            ]
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(1000);

    const result = await mammoth.convertToHtml({ buffer });
    expect(result.value).toContain('<h1>Speech for Event</h1>');
    expect(result.value).toContain('<strong>bold emphasis</strong>');
  });

  it('generates genuine binary PDF with jsPDF', async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.text('Teleprompter Script Content', 10, 10);
    const pdfBytes = pdf.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(500);

    // Verify PDF header magic bytes "%PDF-"
    const headerStr = String.fromCharCode(...new Uint8Array(pdfBytes.slice(0, 5)));
    expect(headerStr).toBe('%PDF-');
  });

  it('performs multilingual DOCX roundtrip preserving English, Urdu, and Hindi script', async () => {
    const { exportToDocx, importFromDocx } = await import('../../src/modules/scripts/documentConverter.js');
    const title = 'Multilingual Studio Speech';
    const content = '<p>English broadcast segment with news bulletin.</p><p>اردو اسکرپٹ: ٹیلی پرامپٹر اسٹوڈیو پرو اردو متن کو مکمل طور پر سپورٹ کرتا ہے۔</p><p>हिंदी स्क्रिप्ट: टेलीप्रॉम्प्टर स्टूडियो प्रो में आपका स्वागत है।</p>';
    
    const docxBlob = await exportToDocx(title, content);
    expect(docxBlob.size).toBeGreaterThan(2000);

    const importedHtml = await importFromDocx(docxBlob);
    expect(importedHtml).toContain('Multilingual Studio Speech');
    expect(importedHtml).toContain('English broadcast segment');
    expect(importedHtml).toContain('ٹیلی پرامپٹر اسٹوڈیو پرو');
    expect(importedHtml).toContain('टेलीप्रॉम्प्टर स्टूडियो प्रो');
  });

  it('performs multi-page PDF generation and text extraction across pages', async () => {
    const { exportToPdf, importFromPdf } = await import('../../src/modules/scripts/documentConverter.js');
    const title = 'MultiPage Extended Document';
    // Generate text long enough to span multiple pages (> 30 paragraphs)
    const longContent = Array.from({ length: 35 }, (_, i) => `<p>Paragraph ${i + 1}: Extended teleprompter text line demonstrating automatic page splitting in PDF documents.</p>`).join('\n');

    const pdfBlob = await exportToPdf(title, longContent);
    expect(pdfBlob.size).toBeGreaterThan(5000);

    const extractedHtml = await importFromPdf(pdfBlob);
    expect(extractedHtml).toContain('MultiPage Extended Document');
    expect(extractedHtml).toContain('Paragraph 1:');
    expect(extractedHtml).toContain('Paragraph 35:');
    
    const lines = extractedHtml.split('</p>');
    expect(lines.length).toBeGreaterThan(30);
  });
});
