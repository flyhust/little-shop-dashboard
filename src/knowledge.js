export async function readKnowledge(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('单个文件请小于 5 MB。');
  const extension = file.name.split('.').at(-1).toLowerCase();
  let text = '';
  if (['txt', 'md', 'csv'].includes(extension)) text = await file.text();
  else if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    try { for (let i = 1; i <= Math.min(document.numPages, 100); i++) { const page = await document.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('') + '\n'; } if (document.numPages > 100) throw new Error('第一版支持最多 100 页的 PDF，请拆分后上传。'); } finally { await document.destroy(); }
  } else if (extension === 'docx') { const mammoth = await import('mammoth/mammoth.browser'); const result = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() }); text = result.value; }
  else throw new Error('支持 PDF、DOCX、TXT、MD 和 CSV 文件。');
  if (!text.trim()) throw new Error('没有读到文字。扫描版 PDF 请先转为可选择文字的文档。');
  if (text.length > 150000) throw new Error('文件文字超过 15 万字，请拆分后再上传。');
  return text.trim();
}
