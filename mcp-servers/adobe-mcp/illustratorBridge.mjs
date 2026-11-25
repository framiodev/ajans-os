import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeFormat, safeSegment } from '../../backend/security.mjs';

function escapeJsx(str = '') {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\r');
}

function runIllustratorJsx(jsxCode) {
  return new Promise(async (resolve, reject) => {
    const tmpJsx = path.join(os.tmpdir(), `ajansos_ai_${Date.now()}.jsx`);
    await fs.writeFile(tmpJsx, jsxCode, 'utf8');
    const psCmd = `$ai = New-Object -ComObject Illustrator.Application; $ai.DoJavaScriptFile("${tmpJsx.replace(/\\/g, '\\\\')}")`;
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { timeout: 45000 }, async (err, stdout, stderr) => {
      await fs.unlink(tmpJsx).catch(() => {});
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

export async function generateVectorPostAi({ brand, copy, format = 'post', outputDir }) {
  format = safeFormat(format);
  const dims =
    format === 'story' ? { w: 1080, h: 1920 } : format === 'linkedin' ? { w: 1920, h: 1080 } : { w: 1080, h: 1350 };

  const safeName = `${safeSegment(brand.id, 'brand')}_${format}_${Date.now()}`;
  const aiPath = path.join(outputDir, `${safeName}.ai`).replace(/\\/g, '/');

  const jsx = `
    var doc = app.documents.add(DocumentColorSpace.RGB, ${dims.w}, ${dims.h});
    var titleFrame = doc.textFrames.add();
    titleFrame.contents = "${escapeJsx(copy.title || brand.name)}";
    titleFrame.top = ${dims.h - 220};
    titleFrame.left = 90;
    titleFrame.textRange.characterAttributes.size = 64;

    var descFrame = doc.textFrames.add();
    descFrame.contents = "${escapeJsx(copy.desc || '')}";
    descFrame.top = ${dims.h - 380};
    descFrame.left = 90;
    descFrame.textRange.characterAttributes.size = 28;

    doc.saveAs(new File("${escapeJsx(aiPath)}"), new IllustratorSaveOptions());
  `;

  await fs.mkdir(outputDir, { recursive: true });
  await runIllustratorJsx(jsx);
  return { aiPath };
}
