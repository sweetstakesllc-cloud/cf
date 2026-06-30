/**
 * Seam for the v2/v3 engagement features — loyalty & referral, in-app chat,
 * live selling. These are FRONTEND STUBS: the shapes here are deliberately
 * thin and vendor-agnostic so that when a real tool is chosen (Smile.io /
 * LoyaltyLion for loyalty, Intercom / Gorgias for chat, a video provider for
 * live), only the bodies of these functions change — never the screens.
 *
 * Same contract as mockProducts.ts: export functions, return Promises, do the
 * shaping here.
 */

import { CATALOG } from './catalogSnapshot';
import type { Product } from '../types/product';

const delay = <T,>(value: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/* ------------------------------- Loyalty -------------------------------- */

export type LoyaltyTier = 'Member' | 'Insider' | 'Archive';

export type EarnRule = { label: string; points: string };
export type Reward = { id: string; label: string; cost: number; locked?: boolean };

export type Loyalty = {
  points: number;
  tier: LoyaltyTier;
  nextTier: { name: LoyaltyTier; at: number } | null; // points threshold for next tier
  earn: EarnRule[];
  rewards: Reward[];
};

export async function getLoyalty(): Promise<Loyalty> {
  return delay({
    points: 1240,
    tier: 'Insider',
    nextTier: { name: 'Archive', at: 2000 },
    earn: [
      { label: 'Every 1 kr spent', points: '+1 pt' },
      { label: 'Sell a piece to us', points: '+500 pts' },
      { label: 'Refer a friend', points: '+750 pts' },
      { label: 'Write a review', points: '+100 pts' },
    ],
    rewards: [
      { id: 'r1', label: '100 kr off your next order', cost: 1000 },
      { id: 'r2', label: 'Free express shipping', cost: 750 },
      { id: 'r3', label: 'Early access to drops', cost: 1500, locked: true },
      { id: 'r4', label: '300 kr off', cost: 3000, locked: true },
    ],
  });
}

/* ------------------------------- Referral ------------------------------- */

export type Referral = {
  code: string;
  friendReward: string; // what the invited friend gets
  youReward: string; // what the referrer gets
  invited: number;
  joined: number;
};

export async function getReferral(): Promise<Referral> {
  return delay({
    code: 'CIRCULAR-AMARA',
    friendReward: '150 kr off their first order',
    youReward: '750 pts + 150 kr',
    invited: 6,
    joined: 2,
  });
}

/* ----------------------------- Live selling ----------------------------- */

export type LiveStatus = 'live' | 'upcoming' | 'ended';
export type LiveShow = {
  id: string;
  title: string;
  host: string;
  status: LiveStatus;
  startsAt: string; // ISO; for 'live' this is the start time
  cover: string; // image url
  viewers?: number; // present when live
  featured: Product[]; // pieces dropping in the show
};

// Borrow real catalog imagery + pieces so the stub looks like the real thing.
const pickProducts = (n: number, offset = 0): Product[] =>
  CATALOG.slice(offset, offset + n).map((p) => ({ ...p }));

export async function getLiveShows(): Promise<LiveShow[]> {
  const live = pickProducts(4, 0);
  const soon = pickProducts(4, 4);
  const past = pickProducts(3, 8);
  return delay([
    {
      id: 'live-1',
      title: 'Moncler Down Drop — Friday Night',
      host: 'Amara @ Circular Fash',
      status: 'live',
      startsAt: '2026-06-26T19:00:00Z',
      cover: live[0]?.images[0] ?? '',
      viewers: 213,
      featured: live,
    },
    {
      id: 'live-2',
      title: 'Gucci Archive — Bags & Belts',
      host: 'Amara @ Circular Fash',
      status: 'upcoming',
      startsAt: '2026-06-28T18:00:00Z',
      cover: soon[0]?.images[0] ?? '',
      featured: soon,
    },
    {
      id: 'live-3',
      title: 'Stone Island Shadow Project',
      host: 'Jonas @ Circular Fash',
      status: 'ended',
      startsAt: '2026-06-22T18:00:00Z',
      cover: past[0]?.images[0] ?? '',
      featured: past,
    },
  ]);
}

/* ------------------------------ Support chat ---------------------------- */

export type ChatAuthor = 'user' | 'agent';
export type ChatMessage = { id: string; from: ChatAuthor; text: string; at: string };

// A short seeded thread so the screen isn't empty. A real build hands this to
// the support vendor's SDK and these become live messages.
let THREAD: ChatMessage[] = [
  { id: 'm1', from: 'agent', text: 'Hi! You’re chatting with Circular Fash support. How can we help?', at: '2026-06-26T09:00:00Z' },
  { id: 'm2', from: 'user', text: 'Is the Moncler Kenya jacket still available in XL?', at: '2026-06-26T09:01:00Z' },
  { id: 'm3', from: 'agent', text: 'It is — one piece left. One-of-one, so it isn’t held until checkout completes. Want me to send the link?', at: '2026-06-26T09:01:40Z' },
];

export async function getChatThread(): Promise<ChatMessage[]> {
  return delay(THREAD.map((m) => ({ ...m })));
}

/**
 * Append a user message and return an auto-acknowledgement from the "agent".
 * Stand-in for the support tool's send + webhook reply.
 */
export async function sendChatMessage(text: string): Promise<ChatMessage[]> {
  const n = THREAD.length;
  THREAD = [
    ...THREAD,
    { id: `m${n + 1}`, from: 'user', text, at: '2026-06-26T09:05:00Z' },
    {
      id: `m${n + 2}`,
      from: 'agent',
      text: 'Thanks — a stylist will jump in shortly. Pieces are one-of-one, so if you’ve got your eye on something, add it to your bag to hold your place at checkout.',
      at: '2026-06-26T09:05:20Z',
    },
  ];
  return delay(THREAD.map((m) => ({ ...m })));
}
