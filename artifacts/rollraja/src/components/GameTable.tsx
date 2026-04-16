import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Player, GameState, TableTier, SideBet, RollResult, SideBetResult, DiceFace
} from '../lib/game';
import {
  rollDice, evaluateRoll, makeBotId, getAvatarInitials,
  TABLE_BETS, TABLE_NAMES, BOT_NAMES, MAX_SEATS, MIN_PLAYERS,
  MAX_NO_DOUBLES, COUNTDOWN_SECONDS, getSeatPosition,
} from '../lib/game';
import type { StoredUser } from '../lib/game';
import Dice from './Dice';
import {
  playDiceRattle, playWinChime, playLossTone, playChipStack,
  playCountdownTick, playNoDouble, playBetPlaced,
} from '../lib/audio';

interface GameTableProps {
  user: StoredUser;
  tableTier: TableTier;
  onLeave: (finalBalance: number) => void;
}

const BET_AMOUNT = TABLE_BETS;

type Toast = { id: number; msg: string };

export default function GameTable({ user, tableTier, onLeave }: GameTableProps) {
  const betAmount = BET_AMOUNT[tableTier];

  // ── State ──────────────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<Player[]>([]);
  const [tableSeats, setTableSeats] = useState<(string | null)[]>(Array(MAX_SEATS).fill(null));
  const [activePlayers, setActivePlayers] = useState<[string, string] | null>(null);
  const [currentRoller, setCurrentRoller] = useState<string | null>(null);
  const [dice, setDice] = useState<[DiceFace, DiceFace] | null>(null);
  const [pot, setPot] = useState(0);
  const [noDoubleCount, setNoDoubleCount] = useState(0);
  const [sideBets, setSideBets] = useState<SideBet[]>([]);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [phase, setPhase] = useState<'waiting' | 'rolling' | 'result' | 'between' | 'eliminated'>('between');
  const [roundLog, setRoundLog] = useState<string[]>([]);
  const [myBalance, setMyBalance] = useState(user.balance);
  const [queueOrder, setQueueOrder] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mySideBet, setMySideBet] = useState<SideBet | null>(null);
  const [sideBetAmount, setSideBetAmount] = useState(betAmount);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [roundCount, setRoundCount] = useState(0);

  const toastId = useRef(0);
  const phaseRef = useRef(phase);
  const playersRef = useRef(players);
  const activeRef = useRef(activePlayers);
  const rollerRef = useRef(currentRoller);
  const potRef = useRef(pot);
  const ndCountRef = useRef(noDoubleCount);
  const queueRef = useRef(queueOrder);
  const myBalRef = useRef(myBalance);
  const sideBetsRef = useRef(sideBets);

  phaseRef.current = phase;
  playersRef.current = players;
  activeRef.current = activePlayers;
  rollerRef.current = currentRoller;
  potRef.current = pot;
  ndCountRef.current = noDoubleCount;
  queueRef.current = queueOrder;
  myBalRef.current = myBalance;
  sideBetsRef.current = sideBets;

  function addToast(msg: string) {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }

  function addLog(msg: string) {
    setRoundLog(l => [msg, ...l].slice(0, 40));
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    initTable();
  }, []);

  function initTable() {
    const mePlayer: Player = {
      id: user.id,
      name: user.name,
      balance: user.balance,
      isBot: false,
      isMe: true,
      status: 'queue',
      seatIndex: 0,
      avatarInitials: getAvatarInitials(user.name),
    };

    // pick bots
    const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, MAX_SEATS - 1);
    const bots: Player[] = shuffled.map((name, i) => ({
      id: makeBotId(name),
      name,
      balance: betAmount * (20 + Math.floor(Math.random() * 30)),
      isBot: true,
      isMe: false,
      status: 'queue' as const,
      seatIndex: i + 1,
      avatarInitials: getAvatarInitials(name),
    }));

    const allPlayers = [mePlayer, ...bots];
    setPlayers(allPlayers);

    const seats: (string | null)[] = Array(MAX_SEATS).fill(null);
    allPlayers.forEach(p => { if (p.seatIndex !== null) seats[p.seatIndex] = p.id; });
    setTableSeats(seats);

    // queue order — me first, then bots in order
    const queue = allPlayers.map(p => p.id);
    setQueueOrder(queue);
    queueRef.current = queue;

    // Start first round after a brief pause
    setTimeout(() => startRound(allPlayers, queue), 1200);
  }

  // ── Round management ───────────────────────────────────────────────────────
  function startRound(currentPlayers?: Player[], currentQueue?: string[]) {
    const pls = currentPlayers ?? playersRef.current;
    const queue = currentQueue ?? queueRef.current;

    // Get non-eliminated players in queue order
    const eligible = queue.filter(id => {
      const p = pls.find(x => x.id === id);
      return p && p.status !== 'eliminated' && p.balance >= betAmount;
    });

    if (eligible.length < 2) {
      // Not enough — refill bots
      const refilled = refillBots(pls, queue);
      if (refilled) return;
      addToast('Not enough players — waiting...');
      return;
    }

    const [roller, opponent] = [eligible[0], eligible[1]];
    setActivePlayers([roller, opponent]);
    activeRef.current = [roller, opponent];
    setCurrentRoller(roller);
    rollerRef.current = roller;
    setPot(betAmount * 2);
    potRef.current = betAmount * 2;
    setNoDoubleCount(0);
    ndCountRef.current = 0;
    setSideBets([]);
    sideBetsRef.current = [];
    setMySideBet(null);
    setDice(null);
    setLastResult(null);

    setRoundCount(c => c + 1);

    // Deduct bets from both players
    setPlayers(prev => prev.map(p => {
      if (p.id === roller || p.id === opponent) {
        const newBal = p.balance - betAmount;
        if (p.isMe) {
          setMyBalance(newBal);
          myBalRef.current = newBal;
        }
        return { ...p, balance: newBal, status: 'playing' as const };
      }
      if (eligible.indexOf(p.id) >= 2) return { ...p, status: 'spectating' as const };
      return { ...p, status: p.status === 'eliminated' ? 'eliminated' as const : 'spectating' as const };
    }));

    playChipStack();
    addLog(`New round: ${pls.find(x => x.id === roller)?.name} rolls vs ${pls.find(x => x.id === opponent)?.name}`);

    // Begin countdown
    beginCountdown(roller, opponent, pls, queue);
  }

  function beginCountdown(roller: string, opponent: string, pls: Player[], queue: string[]) {
    setPhase('waiting');
    setCountdown(COUNTDOWN_SECONDS);
    let cnt = COUNTDOWN_SECONDS;
    const iv = setInterval(() => {
      cnt -= 1;
      setCountdown(cnt);
      playCountdownTick();
      if (cnt <= 0) {
        clearInterval(iv);
        executeBotSideBets(pls);
        executeRoll(roller, opponent, pls, queue);
      }
    }, 1000);
  }

  function executeBotSideBets(pls: Player[]) {
    const active = activeRef.current;
    if (!active) return;
    const [roller, opponent] = active;

    const newBets: SideBet[] = [];
    pls.forEach(p => {
      if (p.isBot && p.status === 'spectating' && p.balance >= betAmount && Math.random() < 0.45) {
        const target = Math.random() < 0.5 ? roller : opponent;
        const amount = betAmount;
        newBets.push({ bettorId: p.id, targetPlayerId: target, amount });
      }
    });

    if (newBets.length > 0) {
      setSideBets(prev => {
        const next = [...prev, ...newBets];
        sideBetsRef.current = next;
        return next;
      });
      setPlayers(prev => prev.map(p => {
        const bet = newBets.find(b => b.bettorId === p.id);
        if (bet) return { ...p, balance: p.balance - bet.amount };
        return p;
      }));
    }
  }

  function executeRoll(roller: string, opponent: string, pls: Player[], queue: string[]) {
    setPhase('rolling');
    setRolling(true);
    playDiceRattle();

    setTimeout(() => {
      setRolling(false);
      const d = rollDice();
      setDice(d);
      const outcome = evaluateRoll(d);
      const ndCount = ndCountRef.current;

      const playerMap = new Map(playersRef.current.map(p => [p.id, p]));
      const rollerName = playerMap.get(roller)?.name ?? 'Unknown';
      const oppName = playerMap.get(opponent)?.name ?? 'Unknown';

      if (outcome === 'win' || (outcome === 'no-double' && ndCount + 1 >= MAX_NO_DOUBLES)) {
        const type = outcome === 'win' ? 'win' : 'default-win';
        const sbResults = resolveSideBets(sideBetsRef.current, roller, pls);
        const currentPot = potRef.current;

        const result: RollResult = {
          dice: d,
          type,
          rollerId: roller,
          winnerId: roller,
          loserId: opponent,
          pot: currentPot,
          sideBetResults: sbResults,
        };
        setLastResult(result);
        setPhase('result');

        if (type === 'win') {
          playWinChime();
          addLog(`${rollerName} rolled ${d[0]}-${d[1]}! DOUBLE ${d[0]} — wins ₹${currentPot}`);
          addToast(`${rollerName} wins with double ${d[0]}!`);
        } else {
          playWinChime();
          addLog(`6 no-doubles — ${rollerName} wins by default! ₹${currentPot}`);
          addToast(`${rollerName} wins by default!`);
        }

        setTimeout(() => afterRound(roller, opponent, pls, queue, sbResults), 3000);

      } else if (outcome === 'loss') {
        const sbResults = resolveSideBets(sideBetsRef.current, opponent, pls);
        const currentPot = potRef.current;

        const result: RollResult = {
          dice: d,
          type: 'loss',
          rollerId: roller,
          winnerId: opponent,
          loserId: roller,
          pot: currentPot,
          sideBetResults: sbResults,
        };
        setLastResult(result);
        setPhase('result');
        playLossTone();
        addLog(`${rollerName} rolled ${d[0]}-${d[1]}! DOUBLE ${d[0]} — ${rollerName} loses. ${oppName} wins ₹${currentPot}`);
        addToast(`${rollerName} loses — double ${d[0]}!`);

        setTimeout(() => afterRound(opponent, roller, pls, queue, sbResults), 3000);

      } else {
        // No double
        const newNd = ndCount + 1;
        setNoDoubleCount(newNd);
        ndCountRef.current = newNd;
        playNoDouble();
        addLog(`${rollerName} rolled ${d[0]}-${d[1]}. No double (${newNd}/${MAX_NO_DOUBLES}).`);

        setPhase('between');
        // Swap roller
        setTimeout(() => {
          const newRoller = opponent;
          const newOpponent = roller;
          setCurrentRoller(newRoller);
          rollerRef.current = newRoller;
          setActivePlayers([newRoller, newOpponent]);
          activeRef.current = [newRoller, newOpponent];
          beginCountdown(newRoller, newOpponent, playersRef.current, queueRef.current);
        }, 1200);
      }
    }, 900);
  }

  function resolveSideBets(bets: SideBet[], winnerId: string, pls: Player[]): SideBetResult[] {
    return bets.map(b => {
      const won = b.targetPlayerId === winnerId;
      const net = won ? b.amount : -b.amount;
      return { bettorId: b.bettorId, won, amount: b.amount, net };
    });
  }

  function afterRound(winnerId: string, loserId: string, pls: Player[], queue: string[], sbResults: SideBetResult[]) {
    const currentPot = potRef.current;

    // Update balances
    setPlayers(prev => {
      let next = prev.map(p => {
        if (p.id === winnerId) {
          const newBal = p.balance + currentPot;
          if (p.isMe) { setMyBalance(newBal); myBalRef.current = newBal; }
          return { ...p, balance: newBal, status: 'playing' as const };
        }
        if (p.id === loserId) {
          // loser goes to spectating or eliminated
          const newStatus = p.balance < betAmount ? 'eliminated' as const : 'spectating' as const;
          return { ...p, status: newStatus };
        }
        // Side bet payouts
        const sbr = sbResults.find(s => s.bettorId === p.id);
        if (sbr) {
          const newBal = p.balance + sbr.amount * (sbr.won ? 2 : 0);
          if (p.isMe) { setMyBalance(newBal); myBalRef.current = newBal; }
          return { ...p, balance: newBal, status: 'spectating' as const };
        }
        return p;
      });

      // Check me eliminated
      const me = next.find(p => p.isMe);
      if (me && me.balance < betAmount && me.id !== winnerId) {
        // me eliminated
        next = next.map(p => p.isMe ? { ...p, status: 'eliminated' as const } : p);
        addToast('You have been eliminated!');
      }

      playersRef.current = next;
      return next;
    });

    // Update queue — loser goes to end
    setQueueOrder(prev => {
      const withoutLoser = prev.filter(id => id !== loserId);
      const next = [...withoutLoser, loserId];
      queueRef.current = next;
      return next;
    });

    setSideBets([]);
    sideBetsRef.current = [];
    setMySideBet(null);

    // Check if me eliminated
    setTimeout(() => {
      const me = playersRef.current.find(p => p.isMe);
      if (me && me.balance < betAmount) {
        setPhase('eliminated');
        return;
      }
      setPhase('between');
      startRound(playersRef.current, queueRef.current);
    }, 400);
  }

  function refillBots(pls: Player[], queue: string[]): boolean {
    // Remove broke bots, add fresh ones
    const broke = pls.filter(p => p.isBot && p.balance < betAmount);
    if (broke.length === 0) return false;
    const freshBots: Player[] = broke.map(b => {
      const newName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      return {
        ...b,
        id: makeBotId(newName),
        name: newName,
        balance: betAmount * (20 + Math.floor(Math.random() * 20)),
        status: 'queue' as const,
        avatarInitials: getAvatarInitials(newName),
      };
    });

    const refreshedPls = pls.map(p => {
      const fresh = freshBots.find(f => f.seatIndex === p.seatIndex);
      return fresh ?? p;
    });

    const refreshedQueue = queue.map(id => {
      const p = pls.find(x => x.id === id);
      const fresh = freshBots.find(f => f.seatIndex === p?.seatIndex);
      return fresh ? fresh.id : id;
    });

    setPlayers(refreshedPls);
    playersRef.current = refreshedPls;
    setQueueOrder(refreshedQueue);
    queueRef.current = refreshedQueue;

    setTimeout(() => startRound(refreshedPls, refreshedQueue), 500);
    return true;
  }

  // ── Side bet (user) ────────────────────────────────────────────────────────
  function placeMySideBet(targetId: string) {
    if (mySideBet) { addToast('You already placed a side bet'); return; }
    if (myBalance < sideBetAmount) { addToast('Insufficient balance'); return; }
    if (activePlayers && (activePlayers[0] === user.id || activePlayers[1] === user.id)) {
      addToast('You are playing — no side bets!'); return;
    }
    if (phase !== 'waiting') { addToast('Side bets close when rolling starts'); return; }

    const bet: SideBet = { bettorId: user.id, targetPlayerId: targetId, amount: sideBetAmount };
    setMySideBet(bet);
    setSideBets(prev => {
      const next = [...prev, bet];
      sideBetsRef.current = next;
      return next;
    });
    setMyBalance(b => { const n = b - sideBetAmount; myBalRef.current = n; return n; });
    setPlayers(prev => prev.map(p => p.isMe ? { ...p, balance: p.balance - sideBetAmount } : p));
    playBetPlaced();
    addToast(`Bet ₹${sideBetAmount} on ${players.find(p => p.id === targetId)?.name}!`);
  }

  // ── Roll button (for me) ───────────────────────────────────────────────────
  function handleManualRoll() {
    if (phase !== 'waiting') return;
    if (activePlayers && activePlayers[0] === user.id) {
      // Skip countdown and roll immediately
      setCountdown(0);
    }
  }

  const tableSize = Math.min(window.innerWidth - 360, window.innerHeight - 80, 600);
  const radius = tableSize / 2;

  const mePlayer = players.find(p => p.isMe);
  const isPlaying = activePlayers && (activePlayers[0] === user.id || activePlayers[1] === user.id);
  const isRoller = currentRoller === user.id;

  function getPlayerById(id: string) { return players.find(p => p.id === id); }

  const rollerPlayer = currentRoller ? getPlayerById(currentRoller) : null;
  const opponentPlayer = activePlayers ? getPlayerById(activePlayers[1] === currentRoller ? activePlayers[0] : activePlayers[1]) : null;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050a05', display: 'flex', overflow: 'hidden' }}>

      {/* ── LEFT PANEL — Queue ── */}
      <div className="queue-panel">
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.25em', color: 'rgba(201,168,76,0.5)', marginBottom: 4 }}>
          QUEUE ORDER
        </div>
        <div className="gold-divider" style={{ marginBottom: 8 }} />
        {queueOrder.map((id, idx) => {
          const p = players.find(x => x.id === id);
          if (!p) return null;
          const isActive = activePlayers && (activePlayers[0] === id || activePlayers[1] === id);
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px',
              borderRadius: 4,
              background: isActive ? 'rgba(201,168,76,0.1)' : 'transparent',
              border: isActive ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
              opacity: p.status === 'eliminated' ? 0.4 : 1,
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: p.isBot ? '#2c4c6e' : 'linear-gradient(135deg, #8b6914, #c9a84c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 700, color: p.isBot ? '#adc8e8' : '#1a0a00',
                fontFamily: 'Cinzel, serif', flexShrink: 0,
                border: `1px solid ${p.isMe ? '#c9a84c' : p.isBot ? '#5a8cbf' : '#888'}`,
              }}>
                {idx + 1}
              </div>
              <div>
                <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: p.isMe ? '#c9a84c' : '#e0d0b0', fontWeight: p.isMe ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                  {p.isMe ? 'You' : p.name.split(' ')[0]}
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: 8, color: p.status === 'eliminated' ? '#c0392b' : 'rgba(201,168,76,0.6)' }}>
                  {p.status === 'eliminated' ? 'OUT' : `₹${p.balance}`}
                </div>
              </div>
            </div>
          );
        })}

        {/* Round log */}
        <div className="gold-divider" style={{ marginTop: 12 }} />
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.4)', marginBottom: 4 }}>
          ROUND LOG
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {roundLog.map((log, i) => (
            <div key={i} style={{ fontFamily: 'Lato, sans-serif', fontSize: 9, color: 'rgba(200,180,140,0.6)', lineHeight: 1.3 }}>
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 160, marginRight: 200, overflow: 'hidden' }}>

        {/* Top bar */}
        <div className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 18, fontWeight: 700 }}>
              <span style={{ color: '#c9a84c' }}>Roll</span>
              <span style={{ color: '#f5f0e8' }}>Raja</span>
            </span>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 10, color: 'rgba(201,168,76,0.6)', letterSpacing: '0.1em' }}>
              {TABLE_NAMES[tableTier]} • ₹{betAmount}/bet
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: 10, color: 'rgba(201,168,76,0.6)', marginRight: 6 }}>YOUR BALANCE</span>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 700, color: '#c9a84c' }}>₹{myBalance.toLocaleString()}</span>
            </div>
            <button className="btn-danger" style={{ fontSize: 10, padding: '5px 12px' }} onClick={() => setShowLeaveConfirm(true)}>
              LEAVE TABLE
            </button>
          </div>
        </div>

        {/* Table area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 50 }}>
          <div style={{ position: 'relative', width: tableSize, height: tableSize }}>

            {/* Casino table */}
            <div className="casino-table" style={{ width: tableSize, height: tableSize }}>

              {/* Table logo */}
              <div className="table-logo">
                <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: Math.max(18, tableSize / 22), fontWeight: 900, opacity: 0.12, color: '#c9a84c', letterSpacing: '0.1em' }}>
                  ROLL RAJA
                </div>
              </div>

              {/* Center action area */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 20,
              }}>

                {/* Pot */}
                <div className="pot-display">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.25em', color: 'rgba(201,168,76,0.6)', marginBottom: 2 }}>
                    POT
                  </div>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, fontWeight: 700, color: '#c9a84c' }}>
                    ₹{pot.toLocaleString()}
                  </div>
                </div>

                {/* Dice */}
                {rolling ? (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <Dice face={1} rolling size="lg" />
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, color: 'rgba(201,168,76,0.5)' }}>·</div>
                    <Dice face={1} rolling size="lg" />
                  </div>
                ) : dice ? (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <Dice face={dice[0]} rolling={false} size="lg" />
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 20, color: 'rgba(201,168,76,0.5)' }}>·</div>
                    <Dice face={dice[1]} rolling={false} size="lg" />
                  </div>
                ) : null}

                {/* Countdown */}
                {phase === 'waiting' && countdown > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(201,168,76,0.6)', marginBottom: 4 }}>
                      {rollerPlayer?.name ?? ''} ROLLING IN
                    </div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 36, fontWeight: 700, color: '#c9a84c' }}>
                      {countdown}
                    </div>
                    <div className="no-double-bar" style={{ justifyContent: 'center', marginTop: 6 }}>
                      {Array.from({ length: MAX_NO_DOUBLES }).map((_, i) => (
                        <div key={i} className={`no-double-dot ${i < noDoubleCount ? 'filled' : ''}`} />
                      ))}
                    </div>
                    <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 9, color: 'rgba(201,168,76,0.4)', marginTop: 3 }}>
                      NO DOUBLE {noDoubleCount}/{MAX_NO_DOUBLES}
                    </div>
                  </div>
                )}

                {/* Active match labels */}
                {activePlayers && phase !== 'result' && (
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: 11, color: currentRoller === activePlayers[0] ? '#c9a84c' : 'rgba(240,230,208,0.5)' }}>
                        {activePlayers[0] === user.id ? 'You' : getPlayerById(activePlayers[0])?.name.split(' ')[0]}
                      </span>
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: 10, color: 'rgba(201,168,76,0.3)' }}>VS</span>
                      <span style={{ fontFamily: 'Cinzel, serif', fontSize: 11, color: currentRoller === activePlayers[1] ? '#c9a84c' : 'rgba(240,230,208,0.5)' }}>
                        {activePlayers[1] === user.id ? 'You' : getPlayerById(activePlayers[1])?.name.split(' ')[0]}
                      </span>
                    </div>
                    {currentRoller && (
                      <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: 'rgba(200,180,140,0.5)', marginTop: 2 }}>
                        {currentRoller === user.id ? '▶ Your turn to roll' : `▶ ${getPlayerById(currentRoller)?.name.split(' ')[0]} is rolling`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Player seats */}
            {players.map(p => {
              if (p.seatIndex === null) return null;
              const pos = getSeatPosition(p.seatIndex, MAX_SEATS, 0.82);
              const isActive = activePlayers && (activePlayers[0] === p.id || activePlayers[1] === p.id);
              const isCurrentRoller = currentRoller === p.id;

              return (
                <div
                  key={p.id}
                  className={`seat`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  }}
                >
                  <div className={`seat-card ${isActive ? 'active-player' : ''} ${p.isMe ? 'is-me' : ''} ${p.status === 'eliminated' ? 'waiting' : ''}`}
                    style={{ border: isCurrentRoller ? '2px solid #c9a84c' : isActive ? '2px solid rgba(201,168,76,0.5)' : '1px solid rgba(201,168,76,0.2)' }}>
                    <div className={`avatar ${p.isBot ? 'bot' : ''} ${p.status === 'eliminated' ? 'eliminated' : ''}`}>
                      {p.avatarInitials}
                    </div>
                    <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: p.isMe ? '#c9a84c' : '#e0d0b0', fontWeight: p.isMe ? 700 : 400 }}>
                      {p.isMe ? 'You' : p.name.split(' ')[0]}
                    </div>
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, color: p.status === 'eliminated' ? '#c0392b' : 'rgba(201,168,76,0.7)' }}>
                      {p.status === 'eliminated' ? 'OUT' : `₹${p.balance}`}
                    </div>
                    {isCurrentRoller && phase === 'waiting' && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c9a84c', margin: '2px auto 0', animation: 'goldenPulse 1s infinite' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Side Bets ── */}
      <div className="side-bet-panel">
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: '0.25em', color: 'rgba(201,168,76,0.5)', marginBottom: 4 }}>
          SIDE BETS
        </div>
        <div className="gold-divider" style={{ marginBottom: 8 }} />

        {isPlaying ? (
          <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: 'rgba(200,180,140,0.5)', textAlign: 'center', padding: '8px 0' }}>
            No side bets while playing
          </div>
        ) : activePlayers && phase === 'waiting' && !mySideBet ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 9, color: 'rgba(201,168,76,0.6)', textAlign: 'center' }}>
              PICK A WINNER
            </div>
            {activePlayers.map(id => {
              const p = getPlayerById(id);
              if (!p) return null;
              return (
                <button
                  key={id}
                  className="btn-ivory"
                  style={{ fontSize: 10, padding: '8px', width: '100%', textAlign: 'center' }}
                  onClick={() => placeMySideBet(id)}
                >
                  <div style={{ fontSize: 11, marginBottom: 2 }}>{p.isMe ? 'Yourself' : p.name.split(' ')[0]}</div>
                  <div style={{ fontSize: 9, color: '#4a1c0a', opacity: 0.7 }}>BET ₹{sideBetAmount}</div>
                </button>
              );
            })}
            <div style={{ marginTop: 4 }}>
              <label style={{ fontFamily: 'Cinzel, serif', fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: '0.1em' }}>
                BET AMOUNT
              </label>
              <input
                type="range"
                className="bet-slider"
                min={Math.min(betAmount, myBalance)}
                max={Math.min(myBalance, betAmount * 5)}
                step={betAmount}
                value={sideBetAmount}
                onChange={e => setSideBetAmount(Number(e.target.value))}
                style={{ marginTop: 4 }}
              />
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, color: '#c9a84c', textAlign: 'center' }}>₹{sideBetAmount}</div>
            </div>
          </div>
        ) : mySideBet ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 10, color: 'rgba(201,168,76,0.7)', marginBottom: 4 }}>BET PLACED</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: '#c9a84c', fontWeight: 700 }}>
              ₹{mySideBet.amount}
            </div>
            <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 9, color: 'rgba(200,180,140,0.6)', marginTop: 4 }}>
              on {getPlayerById(mySideBet.targetPlayerId)?.name.split(' ')[0]}
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: 'rgba(200,180,140,0.4)', textAlign: 'center', padding: '8px 0' }}>
            Wait for next round
          </div>
        )}

        {/* Current side bets list */}
        {sideBets.length > 0 && (
          <>
            <div className="gold-divider" style={{ marginTop: 12 }} />
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 8, color: 'rgba(201,168,76,0.4)', marginBottom: 4, letterSpacing: '0.15em' }}>
              ACTIVE BETS ({sideBets.length})
            </div>
            {sideBets.slice(0, 8).map((b, i) => {
              const bettor = getPlayerById(b.bettorId);
              const target = getPlayerById(b.targetPlayerId);
              return (
                <div key={i} style={{
                  fontFamily: 'Lato, sans-serif', fontSize: 9,
                  color: 'rgba(200,180,140,0.5)',
                  padding: '3px 0',
                  borderBottom: '1px solid rgba(201,168,76,0.05)',
                }}>
                  <span style={{ color: b.bettorId === user.id ? '#c9a84c' : 'inherit' }}>
                    {bettor?.isMe ? 'You' : bettor?.name.split(' ')[0]}
                  </span>
                  {' → '}{target?.name.split(' ')[0]} ₹{b.amount}
                </div>
              );
            })}
          </>
        )}

        {/* Round count */}
        <div style={{ marginTop: 'auto', paddingTop: 12, fontFamily: 'Cinzel, serif', fontSize: 8, color: 'rgba(201,168,76,0.3)', textAlign: 'center' }}>
          ROUND #{roundCount}
        </div>
      </div>

      {/* ── RESULT OVERLAY ── */}
      {phase === 'result' && lastResult && (
        <ResultOverlay
          result={lastResult}
          players={players}
          userId={user.id}
          onContinue={() => setPhase('between')}
        />
      )}

      {/* ── ELIMINATED SCREEN ── */}
      {phase === 'eliminated' && (
        <div className="result-banner">
          <div className="result-card" style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.25em', color: 'rgba(201,168,76,0.6)', marginBottom: 8 }}>
              GAME OVER
            </div>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 30, color: '#c0392b', fontWeight: 700, marginBottom: 8 }}>
              Eliminated
            </div>
            <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 14, color: 'rgba(240,230,208,0.7)', marginBottom: 20 }}>
              Your balance fell below the table minimum.<br />
              Final balance: <span style={{ color: '#c9a84c', fontFamily: 'Cinzel, serif' }}>₹{myBalance}</span>
            </div>
            <button className="btn-gold" onClick={() => onLeave(myBalance)}>
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* ── LEAVE CONFIRM ── */}
      {showLeaveConfirm && (
        <div className="result-banner">
          <div className="result-card" style={{ textAlign: 'center', maxWidth: 320 }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 14, color: '#f0e6d0', marginBottom: 12 }}>
              Leave the table?
            </div>
            <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 12, color: 'rgba(240,230,208,0.6)', marginBottom: 20 }}>
              You will take ₹{myBalance.toLocaleString()} with you.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-gold" onClick={() => onLeave(myBalance)}>Leave</button>
              <button className="btn-ivory" onClick={() => setShowLeaveConfirm(false)}>Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ── Result Overlay Component ─────────────────────────────────────────────────
interface ResultOverlayProps {
  result: RollResult;
  players: Player[];
  userId: string;
  onContinue: () => void;
}

function ResultOverlay({ result, players, userId, onContinue }: ResultOverlayProps) {
  const winner = players.find(p => p.id === result.winnerId);
  const loser = players.find(p => p.id === result.loserId);
  const didIWin = result.winnerId === userId;
  const didILose = result.loserId === userId;

  const mySideBetResult = result.sideBetResults.find(s => s.bettorId === userId);

  const typeLabels: Record<string, string> = {
    win: `DOUBLE ${result.dice[0]}!`,
    loss: `DOUBLE ${result.dice[0]} — LOSS!`,
    'no-double': 'NO DOUBLE',
    'default-win': 'DEFAULT WIN',
  };

  const colors = {
    win: '#27ae60',
    loss: '#c0392b',
    'no-double': '#c9a84c',
    'default-win': '#8e44ad',
  };

  return (
    <div className="result-banner">
      <div className="result-card">
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: '0.3em', color: colors[result.type] ?? '#c9a84c', marginBottom: 8 }}>
          {typeLabels[result.type]}
        </div>

        {/* Dice */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
          <Dice face={result.dice[0]} size="md" />
          <Dice face={result.dice[1]} size="md" />
        </div>

        {/* Winner */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: '#27ae60', letterSpacing: '0.1em' }}>
            ♛ {winner?.isMe ? 'YOU WIN!' : `${winner?.name} WINS`}
          </div>
          {result.winnerId && (
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 16, color: '#c9a84c', fontWeight: 700 }}>
              +₹{result.pot}
            </div>
          )}
        </div>

        {/* Loser */}
        {loser && (
          <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 11, color: 'rgba(200,180,140,0.5)', marginBottom: 12 }}>
            {loser.isMe ? 'You are eliminated from this round' : `${loser.name} sits out`}
          </div>
        )}

        {/* Side bet result */}
        {mySideBetResult && (
          <div style={{
            background: mySideBetResult.won ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)',
            border: `1px solid ${mySideBetResult.won ? 'rgba(39,174,96,0.4)' : 'rgba(192,57,43,0.4)'}`,
            borderRadius: 6, padding: '8px 16px', marginBottom: 12,
            fontFamily: 'Cinzel, serif', fontSize: 12,
          }}>
            Side bet: {mySideBetResult.won
              ? <span style={{ color: '#27ae60' }}>+₹{mySideBetResult.amount * 2} WON!</span>
              : <span style={{ color: '#c0392b' }}>-₹{mySideBetResult.amount} LOST</span>
            }
          </div>
        )}

        <div style={{ fontFamily: 'Lato, sans-serif', fontSize: 10, color: 'rgba(200,180,140,0.4)' }}>
          Next round starting automatically...
        </div>
      </div>
    </div>
  );
}
