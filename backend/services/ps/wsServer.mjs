// Bağımlılıksız minimal WebSocket sunucusu (RFC 6455): yalnızca yerel UXP eklentisi için.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 16 * 1024 * 1024;

export function encodeFrame(text, opcode = 1) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

export class WsConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = [];
    this.fragOpcode = 0;
    this.closed = false;
    socket.on('data', d => this.#onData(d));
    socket.on('close', () => this.#end());
    socket.on('error', () => this.#end());
  }
  send(text) { if (!this.closed) this.socket.write(encodeFrame(text)); }
  close() { if (!this.closed) { try { this.socket.write(encodeFrame('', 8)); } catch {} this.socket.end(); this.#end(); } }
  #end() { if (!this.closed) { this.closed = true; this.emit('close'); } }
  #onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = !!(b0 & 0x80), opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (!masked) return this.#fail(); // istemci çerçeveleri maskeli olmak zorunda
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; const big = this.buf.readBigUInt64BE(2); if (big > BigInt(MAX_PAYLOAD)) return this.#fail(); len = Number(big); off = 10; }
      if (len > MAX_PAYLOAD) return this.#fail();
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      this.buf = this.buf.subarray(off + 4 + len);
      if (opcode === 8) return this.close();
      if (opcode === 9) { this.socket.write(encodeFrame(payload.toString('utf8'), 10)); continue; }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 2) { this.fragments = [payload]; this.fragOpcode = opcode; }
      else if (opcode === 0) this.fragments.push(payload);
      else return this.#fail();
      if (fin) {
        const msg = Buffer.concat(this.fragments);
        this.fragments = [];
        if (this.fragOpcode === 1) this.emit('message', msg.toString('utf8'));
      }
    }
  }
  #fail() { this.socket.destroy(); this.#end(); }
}

// http.Server'ın 'upgrade' olayına bağlanır. verify(req) false dönerse 403.
export function attachWebSocket(httpServer, { path = '/ps', verify, onConnection }) {
  httpServer.on('upgrade', (req, socket) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const key = req.headers['sec-websocket-key'];
      if (url.pathname !== path || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !verify(req, url)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        return socket.destroy();
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      onConnection(new WsConnection(socket), req);
    } catch {
      socket.destroy();
    }
  });
}
