import { useEffect, useReducer, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type TableTier, TABLE_BETS, DICE_FACES, evaluateRoll, type DiceFace, MAX_NO_DOUBLES, MIN_PLAYERS } from '@/lib/game/game';
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
  userWins: number;
  userLosses: number;
  userWinStreak: number;
  tableTier: TableTier;
  onBalanceChange?: (newBalance: number) => void;
}

export function useRealtimeRoom({
  roomId,
  userId,
  userName,
  userBalance,
  userWins,
  userLosses,
  userWinStreak,
  tableTier,
  onBalanceChange,
}: UseRealtimeRoomOptions) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(tableTier));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef<MPGameState>(state);
  const isHostRef = useRef<boolean>(false);
  const resolvingRef = useRef<string | null>(null); // Track which roll we are resolving
  const [isHost, setIsHost] = useState(false);
  const playersRef = useRef<MPPlayer[]>([]);
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
            wins: p.wins || 0,
            losses: p.losses || 0,
            winStreak: p.win_streak || 0,
          });
          seatIdx++;
        }
      });

      // Sort deterministically by user_id
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
          wins: userWins,
          losses: userLosses,
          win_streak: userWinStreak,
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
        wins: userWins,
        losses: userLosses,
        win_streak: userWinStreak,
        online_at: new Date().toISOString(),
      });
    }
  }, [userBalance, userWins, userLosses, userId, userName]);

  // Handle visibility change (reconnect if tab was backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Realtime] Tab visible. Checking connection...');
        if (!channelRef.current || channelRef.current.state !== 'joined') {
          console.log('[Realtime] Channel not joined. Reconnecting...');
          // The main useEffect handles the initial setup, 
          // but we might want to trigger a re-track if the status is weird.
          channelRef.current?.track({
            user_id: userId,
            user_name: userName,
            balance: userBalance,
            wins: userWins,
            losses: userLosses,
            win_streak: userWinStreak,
            online_at: new Date().toISOString(),
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, userName, userBalance, userWins, userLosses]);

  // ─── Broadcast helper ───
  const broadcast = useCallback((action: GameAction) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_action',
      payload: { action },
    });
  }, []);

  // ─── Host: Start game when ≥ MIN_PLAYERS ───
  useEffect(() => {
    if (isHost && state.phase === 'waiting' && state.players.length >= MIN_PLAYERS) {
      const timer = setTimeout(() => {
        const firstRollerId = state.players[Math.floor(Math.random() * state.players.length)].id;
        broadcast({ type: 'GAME_STARTED', firstRollerId });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isHost, state.phase, state.players.length, broadcast]);

  // ─── Sync state for newcomers ───
  useEffect(() => {
    if (!isHost || state.phase === 'waiting') return;
    
    // Broadcast state to sync late joiners whenever player list changes
    broadcast({ 
      type: 'SYNC_STATE', 
      state: {
        phase: state.phase,
        winnerId: state.winnerId,
        queueIds: state.queueIds,
        currentRollerId: state.currentRollerId,
        currentRollerIsWinner: state.currentRollerIsWinner,
        pot: state.pot,
        potCollected: state.potCollected,
        roundNum: state.roundNum,
        die1: state.die1,
        die2: state.die2,
        diceOutcome: state.diceOutcome,
        noDoubleCount: state.noDoubleCount
      }
    });
  }, [state.players.length, isHost, broadcast]);

  // ─── Roll Dice ───
  const roll = useCallback(async () => {
    const s = stateRef.current;
    console.log('Roll clicked. Phase:', s.phase, 'RollerId:', s.currentRollerId, 'UserId:', userId);
    if (s.phase !== 'playing' && s.phase !== 'result') return;

    // Determine who should roll
    const rollerId = s.currentRollerId;
    if (!rollerId || rollerId !== userId) return;

    const roller = s.players.find(p => p.id === rollerId);
    if (!roller) return;

    // Determine opponent
    const opponentId = s.currentRollerIsWinner ? s.queueIds[0] : s.winnerId;
    const opponent = s.players.find(p => p.id === opponentId);
    console.log('OpponentId:', opponentId, 'OpponentFound:', !!opponent);
    if (!opponent) return;

    // Collect bets first if not collected
    if (!s.potCollected) {
      console.log('Collecting bets atomically...');
      try {
        // Create a promise that rejects after 5 seconds
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC Timeout')), 5000)
        );

        const rpcPromise = supabase.rpc('sync_game_balances', {
          p_roller_id: roller.id,
          p_opponent_id: opponent.id,
          p_amount: s.betAmount,
          p_label_roller: `Bet vs ${opponent.name}`,
          p_label_opponent: `Bet vs ${roller.name}`,
          p_room_id: null
        });

        // Race the RPC against the timeout
        const { data, error } = await Promise.race([rpcPromise, timeout]) as any;

        if (error) {
          console.error('Balance sync RPC returned error:', error);
          dispatch({ type: 'ADD_NOTIFICATION', msg: `Sync failed: ${error.message || 'Unauthorized'}`, notifType: 'info' });
          return;
        }

        console.log('Balances synced successfully:', data);
        const pot = s.betAmount * 2;
        broadcast({ type: 'BETS_COLLECTED', pot });

        // Update balances for all participants in the result
        if (Array.isArray(data)) {
          data.forEach((res: { u_id: string; n_balance: number }) => {
            broadcast({ type: 'UPDATE_BALANCE', playerId: res.u_id, newBalance: res.n_balance });
            if (res.u_id === userId) onBalanceChange?.(res.n_balance);
          });
        }
      } catch (err) {
        console.error('Error in sync_game_balances:', err);
        dispatch({ type: 'ADD_NOTIFICATION', msg: 'Error collecting bets', notifType: 'info' });
        return;
      }
    }

    // Roll dice
    console.log('Broadcasting dice rolling...');
    broadcast({ type: 'DICE_ROLLING', rollerId: roller.id });

    // Wait for animation
    setTimeout(() => {
      const d1 = DICE_FACES[Math.floor(Math.random() * 6)] as DiceFace;
      const d2 = DICE_FACES[Math.floor(Math.random() * 6)] as DiceFace;
      broadcast({ type: 'DICE_RESULT', die1: d1, die2: d2, rollerId: roller.id });
    }, 1800);
  }, [userId, roomId, broadcast, onBalanceChange]);

  // ─── Resolve Roll ───
  const resolveRoll = useCallback(async (d1: DiceFace, d2: DiceFace) => {
    const s = stateRef.current;
    const outcome = evaluateRoll([d1, d2]);
    const rollerId = s.currentRollerId;
    const opponentId = s.currentRollerIsWinner ? s.queueIds[0] : s.winnerId;

    if (!rollerId || !opponentId) return;

    if (outcome === 'win') {
      // Roller wins
      await awardWin(rollerId, opponentId, s);
    } else if (outcome === 'loss') {
      // Roller loses — opponent wins
      await awardWin(opponentId, rollerId, s);
    } else {
      // No double — swap roller
      const newNoDouble = s.noDoubleCount + 1;

      if (newNoDouble >= MAX_NO_DOUBLES) {
        // Force roller wins after too many no-doubles
        broadcast({ type: 'ADD_NOTIFICATION', msg: `${MAX_NO_DOUBLES} no-doubles! Roller wins by default!`, notifType: 'win' });
        await awardWin(rollerId, opponentId, s);
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

    // Resolve game win atomically
    try {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC Timeout')), 5000)
      );

      const rpcPromise = supabase.rpc('sync_game_win', {
        p_winner_id: winner.id,
        p_loser_id: loser.id,
        p_win_amount: winAmount,
        p_label: `Won vs ${loser.name}`,
        p_room_id: null
      });

      const { data, error } = await Promise.race([rpcPromise, timeout]) as any;

      if (error) {
        console.error('Win resolution RPC returned error:', error);
      } else if (data !== null) {
        broadcast({ type: 'UPDATE_BALANCE', playerId: winner.id, newBalance: Number(data) });
        if (winner.isMe) onBalanceChange?.(Number(data));
      }
    } catch (err) {
      console.error('Error in sync_game_win:', err);
    } finally {
      // ALWAYS end the round even if DB fails
      broadcast({ type: 'ROUND_ENDED', winnerId: winner.id, loserId: loser.id, winAmount });
      broadcast({ type: 'ADD_NOTIFICATION', msg: `${winner.name} wins ₹${winAmount}!`, notifType: 'win' });

      // Advance round after delay
      setTimeout(() => {
        const latest = stateRef.current;
        const newQueue = [...latest.queueIds];
        
        const filteredQueue = newQueue.filter(id => id !== winnerId && id !== loserId);
        filteredQueue.push(loserId);

        broadcast({
          type: 'ROUND_ADVANCED',
          winnerId: winnerId,
          queueIds: filteredQueue,
          roundNum: latest.roundNum + 1,
        });
      }, 3000);
    }
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
  const currentRoller = state.players.find(p => p.id === state.currentRollerId) || null;
  const isMyTurn = currentRoller?.id === userId;
  // ─── Host: Authoritative Turn Resolution ───
  useEffect(() => {
    if (!isHost || state.phase !== 'result' || !state.die1 || !state.die2) {
      if (state.phase !== 'result') resolvingRef.current = null;
      return;
    }

    const rollKey = `${state.die1}-${state.die2}-${state.currentRollerId}`;
    if (resolvingRef.current === rollKey) return;

    console.log('[Host] Result detected. Resolving roll:', rollKey);
    const timer = setTimeout(() => {
      resolvingRef.current = rollKey;
      if (state.die1 && state.die2) {
        resolveRoll(state.die1, state.die2);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isHost, state.phase, state.die1, state.die2, state.currentRollerId, resolveRoll]);

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
