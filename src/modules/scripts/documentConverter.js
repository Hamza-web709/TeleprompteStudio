/**
 * Lazy Module Loaders for heavy document processing dependencies
 */
let docxModule = null;
async function getDocx() {
  if (!docxModule) {
    docxModule = await import('docx');
  }
  return docxModule;
}

let mammothModule = null;
async function getMammoth() {
  if (!mammothModule) {
    const mod = await import('mammoth');
    mammothModule = mod.default || mod;
  }
  return mammothModule;
}

let jspdfModule = null;
async function getJsPdf() {
  if (!jspdfModule) {
    const mod = await import('jspdf');
    jspdfModule = mod.jsPDF || mod.default;
  }
  return jspdfModule;
}

let pdfjsLibModule = null;
async function getPdfJs() {
  if (!pdfjsLibModule) {
    if (typeof window !== 'undefined') {
      pdfjsLibModule = await import('pdfjs-dist/build/pdf.mjs');
      if (pdfjsLibModule.GlobalWorkerOptions && !pdfjsLibModule.GlobalWorkerOptions.workerSrc) {
        try {
          pdfjsLibModule.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.mjs',
            import.meta.url
          ).toString();
        } catch (e) {
          // Fallback if URL resolution fails
        }
      }
    } else {
      // In Node/Vitest test environment, use legacy build compatible with Node ESM
      pdfjsLibModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
  }
  return pdfjsLibModule;
}

/**
 * Converts HTML content to docx Paragraph objects
 */
function htmlToDocxElements(docx, title, htmlContent) {
  const { Paragraph, HeadingLevel, TextRun } = docx;
  const children = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 }
    })
  ];

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent || '', 'text/html');
    const nodes = doc.body.childNodes;

    for (const node of nodes) {
      if (node.nodeType === 1) { // Element
        const tag = node.tagName.toLowerCase();
        if (tag === 'h1') {
          children.push(new Paragraph({
            text: node.textContent,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 120 }
          }));
        } else if (tag === 'h2') {
          children.push(new Paragraph({
            text: node.textContent,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 160, after: 100 }
          }));
        } else if (tag === 'h3') {
          children.push(new Paragraph({
            text: node.textContent,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 120, after: 80 }
          }));
        } else {
          // Paragraph or other block
          const runs = [];
          for (const child of node.childNodes) {
            if (child.nodeType === 3) { // Text
              if (child.textContent) {
                runs.push(new TextRun({ text: child.textContent }));
              }
            } else if (child.nodeType === 1) {
              const childTag = child.tagName.toLowerCase();
              const isBold = childTag === 'strong' || childTag === 'b';
              const isItalic = childTag === 'em' || childTag === 'i';
              runs.push(new TextRun({
                text: child.textContent,
                bold: isBold,
                italics: isItalic
              }));
            }
          }
          if (runs.length > 0) {
            children.push(new Paragraph({
              children: runs,
              spacing: { after: 120 }
            }));
          } else if (node.textContent.trim()) {
            children.push(new Paragraph({
              text: node.textContent.trim(),
              spacing: { after: 120 }
            }));
          }
        }
      } else if (node.nodeType === 3 && node.textContent.trim()) {
        children.push(new Paragraph({
          text: node.textContent.trim(),
          spacing: { after: 120 }
        }));
      }
    }
  } else {
    // Node environment fallback
    const { Paragraph } = docx;
    const plain = (htmlContent || '').replace(/<[^>]*>/g, ' ').trim();
    children.push(new Paragraph({ text: plain }));
  }

  return children;
}

/**
 * Generate a genuine OpenXML .docx file and trigger browser download
 */
export async function exportToDocx(title, htmlContent) {
  const docx = await getDocx();
  const children = htmlToDocxElements(docx, title, htmlContent);
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children
    }]
  });

  const blob = await docx.Packer.toBlob(doc);
  const filename = `${(title || 'script').replace(/[^a-z0-9_-]/gi, '_')}.docx`;

  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return blob;
}

/**
 * Import a genuine OpenXML .docx file and convert to clean HTML
 */
export async function importFromDocx(fileOrBuffer) {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(fileOrBuffer)) {
    arrayBuffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
  } else {
    throw new Error('Invalid DOCX input: Expected File or ArrayBuffer');
  }

  const mammoth = await getMammoth();
  const options = { arrayBuffer };
  if (typeof Buffer !== 'undefined') {
    options.buffer = Buffer.from(arrayBuffer);
  }
  const result = await mammoth.convertToHtml(options);
  return result.value || '';
}

/**
 * Generate a genuine binary PDF file with proper layout and trigger download
 */
export async function exportToPdf(title, htmlContent) {
  const JsPDF = await getJsPdf();
  const pdf = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - (margin * 2);

  // Document Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(20, 20, 20);
  pdf.text(title || 'Teleprompter Script', margin, 25);

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 30, pageWidth - margin, 30);

  // Clean HTML to text lines/paragraphs
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.setTextColor(40, 40, 40);

  let currentY = 40;
  const lineHeight = 7;

  // Split content into paragraphs
  let rawText = '';
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent || '', 'text/html');
    rawText = doc.body.textContent || '';
  } else {
    rawText = (htmlContent || '').replace(/<[^>]*>/g, '\n');
  }

  const paragraphs = rawText.split(/(?:\r?\n){1,}/).map(p => p.trim()).filter(Boolean);

  for (const para of paragraphs) {
    const wrappedLines = pdf.splitTextToSize(para, maxLineWidth);
    for (const line of wrappedLines) {
      if (currentY + lineHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
      pdf.text(line, margin, currentY);
      currentY += lineHeight;
    }
    currentY += 4; // Paragraph gap
  }

  const filename = `${(title || 'script').replace(/[^a-z0-9_-]/gi, '_')}.pdf`;
  if (typeof window !== 'undefined') {
    pdf.save(filename);
  }

  return pdf.output('blob');
}

/**
 * Import a genuine PDF file and extract text into paragraphs
 */
export async function importFromPdf(fileOrBuffer) {
  let data;
  if (fileOrBuffer instanceof ArrayBuffer) {
    data = new Uint8Array(fileOrBuffer);
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
    const buffer = await fileOrBuffer.arrayBuffer();
    data = new Uint8Array(buffer);
  } else if (fileOrBuffer instanceof Uint8Array) {
    data = fileOrBuffer;
  } else {
    throw new Error('Invalid PDF input: Expected File or ArrayBuffer');
  }

  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  });

  const pdfDoc = await loadingTask.promise;
  const paragraphs = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageLines = [];
    let currentLine = '';

    for (const item of textContent.items) {
      if (item.hasEOL) {
        currentLine += item.str;
        if (currentLine.trim()) pageLines.push(currentLine.trim());
        currentLine = '';
      } else {
        currentLine += item.str + ' ';
      }
    }
    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    if (pageLines.length > 0) {
      paragraphs.push(...pageLines);
    }
  }

  return paragraphs.map(p => `<p>${p}</p>`).join('\n');
}

