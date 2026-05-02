import { useEffect, useReducer, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type TableTier, TABLE_BETS, DICE_FACES, evaluateRoll, type DiceFace, MAX_NO_DOUBLES } from '@/lib/game/game';
import {
  gameReducer,
  createInitialState,
  type MPGameState,
  type MPPlayer,
  type GameAction,
  type MPSideBet,
} from '@/lib/game/gameReducer';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PLAYER_COLORS = ['#9b59b6', '#2e86c1', '#d4a843', '#27ae60', '#e91e8c', '#e67e22', '#1abc9c', '#e74c3c'];

interface UseRealtimeRoomOptions {
  roomId: string;
  userId: string;
  userName: string;
  userBalance: number;
  tableTier: TableTier;
  onBalanceChange?: (newBalance: number) => void;
}

export function useRealtimeRoom({
  roomId,
  userId,
  userName,
  userBalance,
  tableTier,
  onBalanceChange,
}: UseRealtimeRoomOptions) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(tableTier));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isHostRef = useRef(false);
  const [isHost, setIsHost] = useState(false);
  const playersRef = useRef<MPPlayer[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Build presence key
  const presenceKey = userId;

  // ─── Connect to Realtime Channel ───
  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;

    // ── Presence: track players ──
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const players: MPPlayer[] = [];
      let seatIdx = 0;

      Object.entries(presenceState).forEach(([key, presences]) => {
        const p = (presences as any[])[0];
        if (p) {
          players.push({
            id: p.user_id,
            name: p.user_name,
            balance: p.balance,
            avatarColor: PLAYER_COLORS[seatIdx % PLAYER_COLORS.length],
            isMe: p.user_id === userId,
            seatIndex: seatIdx,
          });
          seatIdx++;
        }
      });

      // Sort deterministically by user_id so all clients agree on the queue order
      players.sort((a, b) => a.id.localeCompare(b.id));

      // Reassign seat indices after sort
      players.forEach((p, i) => { p.seatIndex = i; });

      playersRef.current = players;
      dispatch({ type: 'PLAYERS_UPDATED', players });

      // First player is host
      const firstId = players[0]?.id;
      const amHost = firstId === userId;
      isHostRef.current = amHost;
      setIsHost(amHost);
    });

    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const p = (newPresences as any[])[0];
      if (p) {
        dispatch({ type: 'ADD_NOTIFICATION', msg: `${p.user_name} joined the table`, notifType: 'info' });
      }
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      const p = (leftPresences as any[])[0];
      if (p) {
        dispatch({ type: 'ADD_NOTIFICATION', msg: `${p.user_name} left the table`, notifType: 'info' });
      }
    });

    // ── Broadcast: game events ──
    channel.on('broadcast', { event: 'game_action' }, ({ payload }) => {
      if (payload && payload.action) {
        dispatch(payload.action as GameAction);
      }
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          user_name: userName,
          balance: userBalance,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId, userName]);

  // Update presence when balance changes
  useEffect(() => {
    if (channelRef.current) {
      channelRef.current.track({
        user_id: userId,
        user_name: userName,
        balance: userBalance,
        online_at: new Date().toISOString(),
      });
    }
  }, [userBalance]);

  // ─── Broadcast helper ───
  const broadcast = useCallback((action: GameAction) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_action',
      payload: { action },
    });
  }, []);

  // ─── Host: Auto-Start Game when >= 2 players ───
  useEffect(() => {
    if (isHost && state.phase === 'waiting' && state.players.length >= 2) {
      const timer = setTimeout(() => {
        const firstRollerIdx = Math.floor(Math.random() * state.players.length);
        broadcast({ type: 'GAME_STARTED', firstRollerIdx });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isHost, state.phase, state.players.length, broadcast]);

  // ─── Roll Dice ───
  const roll = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase !== 'playing' && s.phase !== 'result') return;

    // Determine who should roll
    const rollerId = state.currentRollerIsWinner ? state.winnerId : state.queueIds[0];
    if (!rollerId) return;
    const roller = state.players.find(p => p.id === rollerId);
    if (!roller || roller.id !== userId) return;

    // Collect bets first if not collected
    if (!state.potCollected) {
      const pA = state.players.find(p => p.id === state.winnerId);
      const pB = state.players.find(p => p.id === state.queueIds[0]);
      if (!pA || !pB) return;

      try {
        // Deduct from both players
        const resultA = await supabase.rpc('deduct_balance', {
          p_user_id: pA.id,
          p_amount: s.betAmount,
          p_label: `Bet vs ${pB.name}`,
        });
        const resultB = await supabase.rpc('deduct_balance', {
          p_user_id: pB.id,
          p_amount: s.betAmount,
          p_label: `Bet vs ${pA.name}`,
        });

        if (resultA.error || resultB.error) {
          dispatch({ type: 'ADD_NOTIFICATION', msg: 'Failed to collect bets', notifType: 'info' });
          return;
        }

        const pot = s.betAmount * 2;
        broadcast({ type: 'BETS_COLLECTED', pot });

        // Update balances
        if (resultA.data !== null) {
          broadcast({ type: 'UPDATE_BALANCE', playerId: pA.id, newBalance: Number(resultA.data) });
          if (pA.isMe) onBalanceChange?.(Number(resultA.data));
        }
        if (resultB.data !== null) {
          broadcast({ type: 'UPDATE_BALANCE', playerId: pB.id, newBalance: Number(resultB.data) });
          if (pB.isMe) onBalanceChange?.(Number(resultB.data));
        }
      } catch {
        dispatch({ type: 'ADD_NOTIFICATION', msg: 'Error collecting bets', notifType: 'info' });
        return;
      }
    }

    // Roll dice
    broadcast({ type: 'DICE_ROLLING', rollerId: roller.id });

    // Wait for animation
    setTimeout(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * 4)] as DiceFace;
      const d2 = DICE_FACES[Math.floor(Math.random() * 4)] as DiceFace;
      broadcast({ type: 'DICE_RESULT', die1: d1, die2: d2, rollerId: roller.id });

      // Resolve the roll
      setTimeout(() => resolveRoll(d1, d2), 800);
    }, 1800);
  }, [userId, roomId, broadcast, onBalanceChange]);

  // ─── Resolve Roll ───
  const resolveRoll = useCallback(async (d1: DiceFace, d2: DiceFace) => {
    const s = stateRef.current;
    const outcome = evaluateRoll([d1, d2]);
    const rollerId = s.currentRollerIsWinner ? s.winnerId : s.queueIds[0];
    const oppId = s.currentRollerIsWinner ? s.queueIds[0] : s.winnerId;

    if (!rollerId || !oppId) return;

    if (outcome === 'win') {
      // Roller wins
      await awardWin(rollerId, oppId, s);
    } else if (outcome === 'loss') {
      // Roller loses — opponent wins
      await awardWin(oppId, rollerId, s);
    } else {
      // No double — swap roller
      const newNoDouble = s.noDoubleCount + 1;

      if (newNoDouble >= MAX_NO_DOUBLES) {
        // Force roller wins after too many no-doubles
        broadcast({ type: 'ADD_NOTIFICATION', msg: `${MAX_NO_DOUBLES} no-doubles! Roller wins by default!`, notifType: 'win' });
        await awardWin(rollerId, oppId, s);
        return;
      }

      broadcast({ type: 'SWAP_ROLLER' });
      broadcast({ type: 'ADD_NOTIFICATION', msg: `${d1} & ${d2} — No double! Turn swaps.`, notifType: 'info' });

      // Auto-roll for next player after delay
      setTimeout(() => {
        broadcast({ type: 'SET_PHASE', phase: 'playing' });
      }, 3000);
    }
  }, [userId, broadcast, onBalanceChange, roomId]);

  // ─── Award Win ───
  const awardWin = useCallback(async (winnerId: string, loserId: string, s: MPGameState) => {
    const winner = s.players.find(p => p.id === winnerId);
    const loser = s.players.find(p => p.id === loserId);
    if (!winner || !loser) return;

    const winAmount = s.pot;

    // Credit winner
    try {
      const result = await supabase.rpc('credit_balance', {
        p_user_id: winner.id,
        p_amount: winAmount,
        p_label: `Won vs ${loser.name}`,
        p_room_id: roomId,
      });
      if (result.data !== null) {
        broadcast({ type: 'UPDATE_BALANCE', playerId: winner.id, newBalance: Number(result.data) });
        if (winner.isMe) onBalanceChange?.(Number(result.data));
      }

      // Record game results
      await supabase.rpc('record_game_result', { p_user_id: winner.id, p_won: true, p_earned: winAmount });
      await supabase.rpc('record_game_result', { p_user_id: loser.id, p_won: false, p_earned: 0 });
    } catch {
      // continue anyway
    }

    broadcast({ type: 'ROUND_ENDED', winnerId: winner.id, loserId: loser.id, winAmount });
    broadcast({ type: 'ADD_NOTIFICATION', msg: `${winner.name} wins ₹${winAmount}!`, notifType: 'win' });

    // Advance round after delay
    setTimeout(() => {
      const latest = stateRef.current;
      let newQueueIds = [...latest.queueIds];
      
      // The current challenger (first in queue) just finished their turn
      const finishedChallengerId = newQueueIds.shift();
      if (finishedChallengerId) {
        newQueueIds.push(finishedChallengerId);
      }
      
      broadcast({
        type: 'ROUND_ADVANCED',
        winnerId: winnerId, 
        queueIds: newQueueIds,
        roundNum: latest.roundNum + 1,
      });
    }, 5000);
  }, [broadcast, roomId, onBalanceChange]);

  // ─── Place Side Bet ───
  const placeSideBet = useCallback((onPlayerId: string, amount: number) => {
    const bet: MPSideBet = {
      bettorId: userId,
      bettorName: userName,
      onPlayerId,
      amount,
      locked: true,
    };
    broadcast({ type: 'SIDE_BET_PLACED', bet });
  }, [userId, userName, broadcast]);

  // ─── Leave Room ───
  const leaveRoom = useCallback(() => {
    channelRef.current?.untrack();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // ─── Derived state ───
  const currentRollerId = state.currentRollerIsWinner ? state.winnerId : state.queueIds[0];
  const currentRoller = state.players.find(p => p.id === currentRollerId) || null;
  const isMyTurn = currentRoller?.id === userId;
  const winnerPlayer = state.players.find(p => p.id === state.winnerId) || null;
  const challengerPlayer = state.players.find(p => p.id === state.queueIds[0]) || null;

  return {
    state,
    dispatch,
    isHost,
    isMyTurn,
    currentRoller,
    winnerPlayer,
    challengerPlayer,
    roll,
    placeSideBet,
    leaveRoom,
    broadcast,
  };
}
