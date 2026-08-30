import { createHash } from 'node:crypto';
import type { WebSocket } from 'ws';
import { maskEmail } from './engine.js';

export const CHAT_MAX_LEN = 280;
export const CHAT_COOLDOWN_MS = 2000;

type Customer = { customerId: string; email: string };

// Public chat identity: stable per customer but not their uuid, so viewers
// can't correlate a chatter with anything outside the stream.
export function chatId(customerId: string): string {
  return createHash('sha256').update(customerId).digest('hex').slice(0, 8);
}

export class Hub {
  private sockets = new Map<WebSocket, Customer | null>();
  private lastChat = new Map<string, number>();
  private muted = new Set<string>();
  constructor(private now: () => Date = () => new Date()) {}

  mute(fromId: string): void {
    this.muted.add(fromId);
  }

  isMuted(fromId: string): boolean {
    return this.muted.has(fromId);
  }

  add(socket: WebSocket, customer: Customer | null): void {
    this.sockets.set(socket, customer);
    socket.on('close', () => {
      this.sockets.delete(socket);
      this.broadcast({ type: 'viewers', count: this.viewerCount() });
    });
    socket.on('message', (raw) => this.handleMessage(socket, customer, String(raw)));
    this.broadcast({ type: 'viewers', count: this.viewerCount() });
  }

  broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const socket of this.sockets.keys()) {
      if (socket.readyState === socket.OPEN) socket.send(data);
    }
  }

  viewerCount(): number {
    return this.sockets.size;
  }

  private handleMessage(socket: WebSocket, customer: Customer | null, raw: string): void {
    let msg: { type?: string; text?: string };
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== 'chat') return;
    if (!customer) return socket.send(JSON.stringify({ type: 'error', error: 'auth_required' }));
    const text = (msg.text ?? '').trim();
    if (!text || text.length > CHAT_MAX_LEN)
      return socket.send(JSON.stringify({ type: 'error', error: 'too_long' }));
    const fromId = chatId(customer.customerId);
    if (this.muted.has(fromId))
      return socket.send(JSON.stringify({ type: 'error', error: 'muted' }));
    const nowMs = this.now().getTime();
    const last = this.lastChat.get(customer.customerId) ?? 0;
    if (nowMs - last < CHAT_COOLDOWN_MS)
      return socket.send(JSON.stringify({ type: 'error', error: 'slow_down' }));
    this.lastChat.set(customer.customerId, nowMs);
    this.broadcast({ type: 'chat', from: maskEmail(customer.email), fromId, text });
  }
}
