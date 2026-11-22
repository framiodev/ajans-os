import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePostPsd, revisePhotoshopLayer } from './photoshopBridge.mjs';
import { generateVectorPostAi } from './illustratorBridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.resolve(__dirname, '../../storage/outputs');

const TOOLS = [
  {
    name: 'photoshop_create_post',
    description: 'Adobe Photoshop uzerinde katmanli PSD ve PNG sosyal medya gonderisi olusturur.',
    inputSchema: {
      type: 'object',
      properties: {
        brand_name: { type: 'string' },
        primary_color: { type: 'string', description: 'Hex renk (orn. #1C1917)' },
        accent_color: { type: 'string', description: 'Hex vurgu rengi (orn. #F59E0B)' },
        eyebrow: { type: 'string' },
        title: { type: 'string' },
        desc: { type: 'string' },
        cta: { type: 'string' },
        format: { type: 'string', enum: ['post', 'story', 'linkedin'] }
      },
      required: ['brand_name', 'title']
    }
  },
  {
    name: 'photoshop_revise_layer',
    description: 'Mevcut bir PSD dosyasinda Turkce talimatla katman revizesi yapar.',
    inputSchema: {
      type: 'object',
      properties: {
        psdPath: { type: 'string' },
        instruction: { type: 'string' }
      },
      required: ['psdPath', 'instruction']
    }
  },
  {
    name: 'illustrator_create_vector',
    description: 'Adobe Illustrator uzerinde vektorel AI artboard olusturur.',
    inputSchema: {
      type: 'object',
      properties: {
        brand_name: { type: 'string' },
        title: { type: 'string' },
        desc: { type: 'string' },
        format: { type: 'string', enum: ['post', 'story', 'linkedin'] }
      },
      required: ['brand_name', 'title']
    }
  }
];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = req;

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'framiomedia-adobe-mcp', version: '1.0.0' }
      }
    });
  }

  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }

  if (method === 'tools/call') {
    try {
      const name = params?.name;
      const args = params?.arguments || {};
      let out;

      if (name === 'photoshop_create_post') {
        const brandId = (args.brand_name || 'marka').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        out = await generatePostPsd({
          brand: {
            id: brandId,
            name: args.brand_name,
            primary_color: args.primary_color || '#0B1120',
            accent_color: args.accent_color || '#D4AF37'
          },
          copy: {
            eyebrow: args.eyebrow || '',
            title: args.title || '',
            desc: args.desc || '',
            cta: args.cta || ''
          },
          format: args.format || 'post',
          outputDir: DEFAULT_OUTPUT
        });
      } else if (name === 'photoshop_revise_layer') {
        out = await revisePhotoshopLayer({ psdPath: args.psdPath, instruction: args.instruction });
      } else if (name === 'illustrator_create_vector') {
        const brandId = (args.brand_name || 'marka').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        out = await generateVectorPostAi({
          brand: { id: brandId, name: args.brand_name },
          copy: { title: args.title || '', desc: args.desc || '' },
          format: args.format || 'post',
          outputDir: DEFAULT_OUTPUT
        });
      } else {
        throw new Error(`Bilinmeyen arac: ${name}`);
      }

      return send({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
      });
    } catch (err) {
      return send({
        jsonrpc: '2.0',
        id,
        result: { isError: true, content: [{ type: 'text', text: err.message }] }
      });
    }
  }
});
