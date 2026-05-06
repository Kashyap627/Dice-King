export const DICE_FACES = [1, 3, 4, 6] as const;
export type DiceFace = typeof DICE_FACES[number];

export type TableTier = 'bronze' | 'silver' | 'gold' | 'vip';
export const TABLE_BETS: Record<TableTier, number> = {
  bronze: 10,
  silver: 50,
  gold: 100,
  vip: 500,
};
export const TABLE_NAMES: Record<TableTier, string> = {
  bronze: 'Bronze Table',
  silver: 'Silver Table',
  gold: 'Gold Table',
  vip: 'VIP Salon',
};

export const MAX_NO_DOUBLES = 6;
export const COUNTDOWN_SECONDS = 5;
export const MIN_PLAYERS = 2;
export const MAX_SEATS = 6;
export const STARTING_BALANCE = 0;
export const BOT_NAMES = [
  'Ravi Kumar', 'Priya Sharma', 'Arjun Patel', 'Sonia Mehta',
  'Vikram Rao', 'Kavya Nair', 'Rohit Singh', 'Deepa Verma',
  'Anil Kapoor', 'Neha Gupta', 'Manish Joshi', 'Sunita Bose',
];

export type PlayerStatus = 'playing' | 'spectating' | 'eliminated' | 'queue';

export interface Player {
  id: string;
  name: string;
  balance: number;
  isBot: boolean;
  isMe: boolean;
  status: PlayerStatus;
  seatIndex: number | null; // seat 0..7 at the table
  avatarInitials: string;
  wins: number;
  losses: number;
}

export interface SideBet {
  bettorId: string;
  targetPlayerId: string; // who they're betting ON to win
  amount: number;
}

export type GamePhase =
  | 'login'
  | 'lobby'
  | 'waiting'       // waiting for round to start (countdown)
  | 'rolling'       // active dice roll
  | 'result'        // showing result
  | 'between';      // between rounds

export interface GameState {
  phase: GamePhase;
  players: Player[];
  tableSeats: (string | null)[]; // array of player IDs by seat index
  activePlayers: [string, string] | null; // [roller, opponent]
  currentRoller: string | null;
  dice: [DiceFace, DiceFace] | null;
  pot: number;
  noDoubleCount: number;
  sideBets: SideBet[];
  lastResult: RollResult | null;
  countdown: number;
  roundLog: string[];
  currentTableTier: TableTier;
  queueOrder: string[]; // who's next in queue
}

export interface RollResult {
  dice: [DiceFace, DiceFace];
  type: 'win' | 'loss' | 'no-double' | 'default-win';
  rollerId: string;
  winnerId: string | null;
  loserId: string | null;
  pot: number;
  sideBetResults: SideBetResult[];
}

export interface SideBetResult {
  bettorId: string;
  won: boolean;
  amount: number;
  net: number;
}

export function rollDice(): [DiceFace, DiceFace] {
  const d1 = DICE_FACES[Math.floor(Math.random() * 4)];
  const d2 = DICE_FACES[Math.floor(Math.random() * 4)];
  return [d1, d2];
}

export function evaluateRoll(dice: [DiceFace, DiceFace]): 'win' | 'loss' | 'no-double' {
  const [d1, d2] = dice;
  if (d1 === d2) {
    if (d1 === 1 || d1 === 3) return 'loss';
    if (d1 === 4 || d1 === 6) return 'win';
  }
  return 'no-double';
}

export function makeBotId(name: string): string {
  return 'bot_' + name.replace(/\s/g, '_').toLowerCase() + '_' + Math.floor(Math.random() * 9000 + 1000);
}

export function getAvatarInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// localStorage persistence
export const STORAGE_KEY = 'rollraja_user';
export interface StoredUser {
  id: string;
  name: string;
  balance: number;
  wins?: number;
  losses?: number;
}

export function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveUser(user: StoredUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {}
}

// Seat positions around a circle
// Returns [x%, y%] as percentages of table radius
export function getSeatPosition(seatIndex: number, totalSeats: number, radiusFraction = 0.85): { x: number; y: number; angle: number } {
  // Start from bottom (player's own seat) and go clockwise
  const offsetAngle = Math.PI / 2; // start at bottom
  const angle = offsetAngle - (seatIndex / totalSeats) * 2 * Math.PI;
  return {
    x: 50 + radiusFraction * 50 * Math.cos(angle),
    y: 50 + radiusFraction * 50 * Math.sin(angle) * -1, // invert y
    angle,
  };
}
