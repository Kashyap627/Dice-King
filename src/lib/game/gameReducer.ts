import { DICE_FACES, evaluateRoll, type DiceFace, type TableTier, TABLE_BETS, MAX_NO_DOUBLES } from './game';

// ─── Multiplayer Game State ───
export interface MPPlayer {
  id: string;
  name: string;
  balance: number;
  avatarColor: string;
  isMe: boolean;
  seatIndex: number;
}

export interface MPSideBet {
  bettorId: string;
  bettorName: string;
  onPlayerId: string;
  amount: number;
  locked: boolean;
}

export type MPPhase =
  | 'waiting'     // waiting for ≥3 players
  | 'countdown'   // countdown before round starts
  | 'playing'     // active round — dice rolling
  | 'rolling'     // dice are physically rolling
  | 'result'      // showing result of roll
  | 'between';    // between rounds

export interface MPGameState {
  phase: MPPhase;
  players: MPPlayer[];
  tableTier: TableTier;
  betAmount: number;
  // Round state
  winnerId: string | null;        // current "champion" ID
  queueIds: string[];             // queue of challenger IDs
  currentRollerIsWinner: boolean;
  noDoubleCount: number;
  roundNum: number;
  // Dice
  die1: DiceFace | null;
  die2: DiceFace | null;
  diceOutcome: 'win' | 'loss' | 'no-double' | null;
  // Pot
  pot: number;
  potCollected: boolean;
  // Side bets
  sideBets: MPSideBet[];
  sidePot: number;
  // Result
  lastWinnerId: string | null;
  lastLoserId: string | null;
  lastWinAmount: number;
  // Roller info
  currentRollerId: string | null;
  // Log
  notifications: { msg: string; type: 'win' | 'loss' | 'bet' | 'info'; time: string }[];
}

export function createInitialState(tableTier: TableTier): MPGameState {
  return {
    phase: 'waiting',
    players: [],
    tableTier,
    betAmount: TABLE_BETS[tableTier],
    winnerId: null,
    queueIds: [],
    currentRollerIsWinner: true,
    noDoubleCount: 0,
    roundNum: 0,
    die1: null,
    die2: null,
    diceOutcome: null,
    pot: 0,
    potCollected: false,
    sideBets: [],
    sidePot: 0,
    lastWinnerId: null,
    lastLoserId: null,
    lastWinAmount: 0,
    currentRollerId: null,
    notifications: [],
  };
}

// ─── Actions ───
export type GameAction =
  | { type: 'PLAYERS_UPDATED'; players: MPPlayer[] }
  | { type: 'GAME_STARTED'; firstRollerIdx: number }
  | { type: 'BETS_COLLECTED'; pot: number }
  | { type: 'DICE_ROLLING'; rollerId: string }
  | { type: 'DICE_RESULT'; die1: DiceFace; die2: DiceFace; rollerId: string }
  | { type: 'ROUND_ENDED'; winnerId: string; loserId: string; winAmount: number }
  | { type: 'ROUND_ADVANCED'; winnerId: string; queueIds: string[]; roundNum: number }
  | { type: 'SIDE_BET_PLACED'; bet: MPSideBet }
  | { type: 'SIDE_BETS_RESOLVED'; results: { bettorId: string; won: boolean; amount: number }[] }
  | { type: 'SWAP_ROLLER' }
  | { type: 'SET_PHASE'; phase: MPPhase }
  | { type: 'ADD_NOTIFICATION'; msg: string; notifType: 'win' | 'loss' | 'bet' | 'info' }
  | { type: 'UPDATE_BALANCE'; playerId: string; newBalance: number }
  | { type: 'RESET_ROUND' };

function addNotif(state: MPGameState, msg: string, notifType: 'win' | 'loss' | 'bet' | 'info'): MPGameState['notifications'] {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const next = [{ msg, type: notifType, time }, ...state.notifications];
  return next.slice(0, 30);
}

export function gameReducer(state: MPGameState, action: GameAction): MPGameState {
  switch (action.type) {
    case 'PLAYERS_UPDATED': {
      const existingIds = action.players.map(p => p.id);
      
      // If we're already in a game, ensure everyone present is in the system
      let newQueueIds = [...state.queueIds];
      
      if (state.phase !== 'waiting' && state.phase !== 'countdown') {
          // Add newly joined players to the end of the queue if they aren't already there or the winner
          action.players.forEach(p => {
              if (p.id !== state.winnerId && !newQueueIds.includes(p.id)) {
                  newQueueIds.push(p.id);
              }
          });
          
          // Remove players who left
          newQueueIds = newQueueIds.filter(id => existingIds.includes(id));
      }

      return { 
          ...state, 
          players: action.players,
          queueIds: newQueueIds,
          winnerId: existingIds.includes(state.winnerId || '') ? state.winnerId : (action.players[0]?.id || null)
      };
    }

    case 'GAME_STARTED': {
      if (state.players.length < 2) return state;
      const fIdx = action.firstRollerIdx % state.players.length;
      const firstRollerId = state.players[fIdx]?.id;
      const queueIds = state.players
        .filter(p => p.id !== firstRollerId)
        .map(p => p.id);
        
      return {
        ...state,
        phase: 'playing',
        winnerId: firstRollerId,
        queueIds,
        currentRollerIsWinner: true,
        roundNum: 0,
        pot: 0,
        potCollected: false,
        noDoubleCount: 0,
        die1: null,
        die2: null,
        diceOutcome: null,
        sideBets: [],
        sidePot: 0,
        currentRollerId: firstRollerId,
        notifications: addNotif(state, `Game started! ${state.players.length} players`, 'info'),
      };
    }

    case 'BETS_COLLECTED': {
      return {
        ...state,
        pot: action.pot,
        potCollected: true,
      };
    }

    case 'DICE_ROLLING': {
      return {
        ...state,
        phase: 'rolling',
        currentRollerId: action.rollerId,
        die1: null,
        die2: null,
        diceOutcome: null,
      };
    }

    case 'DICE_RESULT': {
      const outcome = evaluateRoll([action.die1, action.die2]);
      return {
        ...state,
        phase: 'result',
        die1: action.die1,
        die2: action.die2,
        diceOutcome: outcome,
        currentRollerId: action.rollerId,
      };
    }

    case 'SWAP_ROLLER': {
      return {
        ...state,
        currentRollerIsWinner: !state.currentRollerIsWinner,
        noDoubleCount: state.noDoubleCount + 1,
      };
    }

    case 'ROUND_ENDED': {
      return {
        ...state,
        phase: 'between',
        lastWinnerId: action.winnerId,
        lastLoserId: action.loserId,
        lastWinAmount: action.winAmount,
        pot: 0,
      };
    }

    case 'ROUND_ADVANCED': {
      return {
        ...state,
        phase: 'playing',
        winnerId: action.winnerId,
        queueIds: action.queueIds,
        roundNum: action.roundNum,
        currentRollerIsWinner: true,
        noDoubleCount: 0,
        die1: null,
        die2: null,
        diceOutcome: null,
        pot: 0,
        potCollected: false,
        sideBets: [],
        sidePot: 0,
        lastWinnerId: null,
        lastLoserId: null,
        lastWinAmount: 0,
        currentRollerId: action.winnerId,
      };
    }

    case 'SIDE_BET_PLACED': {
      const sideBets = [...state.sideBets, action.bet];
      const sidePot = sideBets.filter(b => b.locked).reduce((sum, b) => sum + b.amount, 0);
      return {
        ...state,
        sideBets,
        sidePot,
        notifications: addNotif(state, `${action.bet.bettorName} bet ₹${action.bet.amount}`, 'bet'),
      };
    }

    case 'SIDE_BETS_RESOLVED': {
      return {
        ...state,
        sideBets: [],
        sidePot: 0,
      };
    }

    case 'SET_PHASE': {
      return { ...state, phase: action.phase };
    }

    case 'ADD_NOTIFICATION': {
      return {
        ...state,
        notifications: addNotif(state, action.msg, action.notifType),
      };
    }

    case 'UPDATE_BALANCE': {
      return {
        ...state,
        players: state.players.map(p =>
          p.id === action.playerId ? { ...p, balance: action.newBalance } : p
        ),
      };
    }

    case 'RESET_ROUND': {
      return {
        ...state,
        die1: null,
        die2: null,
        diceOutcome: null,
        potCollected: false,
        sideBets: [],
        sidePot: 0,
      };
    }

    default:
      return state;
  }
}
