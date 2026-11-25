// Photoshop yetenek testi: tüm işlemleri boş bir belgede sırayla dener, her biri için çalıştı/çalışmadı raporu verir.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// Gökyüzü geçişli zemin üzerinde net bir "konu" (kırmızı daire): konu seçme ve yerleştirme denemesi için.
export function makeTestPng(file, w = 640, h = 480) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 4 + 1) + 1 + x * 4;
      const inCircle = (x - w / 2) ** 2 + (y - h * 0.58) ** 2 < (h * 0.28) ** 2;
      if (inCircle) { raw[i] = 210; raw[i + 1] = 40; raw[i + 2] = 50; }
      else { raw[i] = 70 + (y / h) * 120; raw[i + 1] = 130 + (y / h) * 90; raw[i + 2] = 220; }
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  return file;
}

export function selfTestOps({ dir }) {
  const imgPath = makeTestPng(path.join(dir, 'yetenek_testi_gorsel.png'));
  const psdPath = path.join(dir, 'yetenek_testi.psd'), pngPath = path.join(dir, 'yetenek_testi.png');
  return [
    { op: 'doc.create', args: { name: 'AjansOS_Yetenek_Testi', width: 1080, height: 1350, resolution: 72 } },
    { op: 'layer.solid', args: { name: 'T_Zemin', color: '#0B2545' } },
    { op: 'layer.image', args: { name: 'T_Gorsel', path: imgPath, x: 0, y: 0, w: 1080, h: 1350 } },
    { op: 'mask.subject', args: { name: 'T_Gorsel' } },
    { op: 'layer.shadow', args: { name: 'T_Gorsel', opacity: 50, blur: 30, distance: 16 } },
    { op: 'shape.gradient', args: { name: 'T_Gecis', color: '#0B2545', angle: 90, opacityStart: 0, opacityEnd: 85 } },
    { op: 'shape.rect', args: { name: 'T_Dikdortgen', x: 80, y: 80, w: 400, h: 160, color: '#E63946', radius: 24 } },
    { op: 'shape.rect', args: { name: 'T_Kenarlikli', x: 520, y: 80, w: 400, h: 160, color: '#E63946', radius: 0, stroke: { color: '#FFFFFF', width: 6 } } },
    { op: 'shape.ellipse', args: { name: 'T_Elips', x: 80, y: 300, w: 240, h: 240, color: '#FFFFFF', opacity: 40 } },
    { op: 'layer.text', args: { name: 'T_Metin_Kalin', contents: 'Ankara İstanbul', x: 360, y: 320, size: 96, color: '#FFFFFF', weight: 'bold', tracking: 40, leading: 100 } },
    { op: 'layer.text', args: { name: 'T_Metin_Buton', contents: 'BİLET AL', x: 360, y: 520, size: 40, color: '#0B2545', weight: 'bold', tracking: 160 } },
    { op: 'shape.behindText', args: { name: 'T_Buton', textLayer: 'T_Metin_Buton', padX: 40, padY: 26, radius: 40, color: '#FFFFFF' } },
    { op: 'shape.arrow', args: { name: 'T_Ok', x: 700, y: 400, w: 220, thickness: 10, color: '#E63946' } },
    { op: 'group.create', args: { name: 'T_Grup', layers: ['T_Dikdortgen', 'T_Kenarlikli', 'T_Elips'], skipMissing: true } },
    { op: 'doc.save', args: { psdPath, pngPath } }
  ];
}
export const SELFTEST_NOTES = {
  'mask.subject': 'Konu seçme (autoCutout) ve maske',
  'layer.shadow': 'Katman gölgesi',
  'shape.gradient': 'Renk geçişi (scrim)',
  'shape.arrow': 'Ok (gövde + dönen kanatlar)',
  'layer.image': 'Görsel yerleştirme',
  'shape.rect': 'Dikdörtgen / kenarlık',
  'shape.ellipse': 'Elips',
  'layer.text': 'Metin (kalın, harf aralığı, satır aralığı)',
  'shape.behindText': 'Metne göre buton',
  'group.create': 'Gruplama',
  'doc.save': 'PSD + PNG kayıt'
};
