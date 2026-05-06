import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { TableTier, StoredUser } from '../lib/game/game';
import { TABLE_BETS, TABLE_NAMES, MIN_PLAYERS } from '../lib/game/game';
import { useRealtimeRoom } from '../hooks/useRealtimeRoom';
import Dice from './Dice';
import Toast, { type ToastMessage } from './Toast';
import {
  playDiceRattle, playWinChime, playLossTone, playChipStack,
  playCountdownTick, playNoDouble, playBetPlaced,
} from '../lib/game/audio';

interface GameTableProps {
  user: StoredUser;
  tableTier: TableTier;
  onLeave: (finalBalance: number) => void;
  onUpdateBalance: (newBalance: number) => void;
}

export default function GameTable({ user, tableTier, onLeave, onUpdateBalance }: GameTableProps) {
  const roomId = `tier_${tableTier}`;
  const betAmount = TABLE_BETS[tableTier];

  const {
    state,
    isHost,
    isMyTurn,
    currentRoller,
    winnerPlayer,
    challengerPlayer,
    roll,
    placeSideBet,
    leaveRoom
  } = useRealtimeRoom({
    roomId,
    userId: user.id,
    userName: user.name,
    userBalance: user.balance,
    userWins: user.wins || 0,
    userLosses: user.losses || 0,
    tableTier,
    onBalanceChange: onUpdateBalance,
  });

  const [sideBetTarget, setSideBetTarget] = useState<string>('');
  const [sideBetAmount, setSideBetAmount] = useState<number>(betAmount);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [personalOverlay, setPersonalOverlay] = useState<{ type: 'win' | 'loss', amount: number } | null>(null);
  const feltRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Seat positioning state
  const [playerAngles, setPlayerAngles] = useState<Record<string, { x: number; y: number; angle: number }>>({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Generate seat positions identically to the prototype but using percentages for responsiveness
    const n = Math.max(state.players.length, 1);
    const seatRadius = 43; // percentage
    const myIdx = Math.max(0, state.players.findIndex(p => p.isMe));

    const newAngles: Record<string, { x: number; y: number; angle: number }> = {};
    state.players.forEach((p, i) => {
      const baseAngle = (2 * Math.PI / n) * i;
      const myBase = (2 * Math.PI / n) * myIdx;
      const angle = baseAngle - myBase + Math.PI / 2; // "Me" at bottom (pi/2)
      
      const sx = Math.cos(angle) * seatRadius;
      const sy = Math.sin(angle) * seatRadius;
      newAngles[p.id] = { x: 50 + sx, y: 50 + sy, angle };
    });
    setPlayerAngles(newAngles);
  }, [state.players]);

  // Audio bindings based on state changes
  useEffect(() => {
    if (state.phase === 'rolling') playDiceRattle();
    if (state.diceOutcome === 'win') playWinChime();
    if (state.diceOutcome === 'loss') playLossTone();
    if (state.diceOutcome === 'no-double') playNoDouble();
    if (state.phase === 'playing' && state.potCollected) playChipStack();
  }, [state.phase, state.diceOutcome, state.potCollected]);

  // Toast listener from notifications
  useEffect(() => {
    const lastNotif = state.notifications[0];
    if (lastNotif) {
      const id = Math.random().toString();
      setToasts(prev => [...prev, { id, msg: lastNotif.msg, type: lastNotif.type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    }
  }, [state.notifications]);

  // Animation Engine for Roll
  useEffect(() => {
    if (state.phase === 'rolling' && currentRoller && wrapperRef.current && feltRef.current) {
      const feltSize = feltRef.current.offsetWidth;
      const pos = playerAngles[currentRoller.id] || { x: feltSize/2, y: feltSize/2 };
      
      // Calculate relative throw origin
      // The wrapper is centered in the dice-center-zone
      const zoneOffY = feltSize * 0.06;
      const pxX = (pos.x / 100) * feltSize;
      const pxY = (pos.y / 100) * feltSize;
      const startX = pxX - feltSize/2;
      const startY = pxY - feltSize/2 + zoneOffY;

      // Draw throw trail
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = feltSize;
        canvas.height = feltSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const cx = feltSize / 2, cy = feltSize / 2;
          const ox = pxX, oy = pxY;
          const steps = 14;

          const drawFrame = (alpha: number) => {
            ctx.clearRect(0, 0, feltSize, feltSize);
            for (let k = 0; k < steps; k++) {
              const t = k / steps;
              const px = ox + (cx - ox) * t;
              const py = oy + (cy - oy) * t - Math.sin(t * Math.PI) * 24;
              const a = (1 - t) * 0.75 * alpha;
              const r = Math.max(0.5, (4 - t * 3) * alpha);
              ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(212,168,67,${a})`; ctx.fill();
            }
            ctx.beginPath(); ctx.arc(ox, oy, 5 * alpha, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,230,100,${0.4 * alpha})`; ctx.fill();
          };

          drawFrame(1);
          let alpha = 1;
          const fade = setInterval(() => {
            alpha -= 0.1;
            if (alpha <= 0) { ctx.clearRect(0, 0, feltSize, feltSize); clearInterval(fade); return; }
            drawFrame(alpha);
          }, 55);
        }
      }

      // Execute Flight Animation using Web Animations API
      const flightFrames = [
        { transform: `translate(${startX}px,${startY}px) scale(0.32) rotate(-8deg)`, opacity: 0.4, offset: 0 },
        { transform: `translate(${startX * 0.62}px,${startY * 0.62 - 32}px) scale(0.58) rotate(4deg)`, opacity: 1, offset: 0.22 },
        { transform: `translate(${startX * 0.28}px,${startY * 0.28 - 18}px) scale(0.82) rotate(-2deg)`, opacity: 1, offset: 0.52 },
        { transform: `translate(0px,6px) scale(1.07) rotate(1deg)`, offset: 0.78 },
        { transform: `translate(0px,-4px) scale(0.97) rotate(0deg)`, offset: 0.9 },
        { transform: `translate(0px,0px) scale(1) rotate(0deg)`, opacity: 1, offset: 1 },
      ];
      
      const flight = wrapperRef.current.animate(flightFrames, { duration: 1700, easing: 'cubic-bezier(0.12,0.6,0.22,1)', fill: 'none' });
      
      flight.onfinish = () => {
        if (wrapperRef.current) {
          wrapperRef.current.animate([
            { transform: 'translate(0,0) scale(1)', offset: 0 },
            { transform: 'translate(0,-10px) scale(1.07)', offset: 0.28 },
            { transform: 'translate(0,4px) scale(0.96)', offset: 0.6 },
            { transform: 'translate(0,-2px) scale(1.02)', offset: 0.82 },
            { transform: 'translate(0,0) scale(1)', offset: 1 },
          ], { duration: 380, easing: 'ease-out', fill: 'none' });
        }
      };
    }
  }, [state.phase, currentRoller, playerAngles]);

  // ─── Listen for Round Result ───
  useEffect(() => {
    if (state.phase === 'result' && state.diceOutcome) {
      const isWinner = state.winnerId === user.id;
      const rollerId = state.currentRollerId;
      const opponentId = state.currentRollerIsWinner ? state.queueIds[0] : state.winnerId;
      const isLoser = (rollerId === user.id && state.diceOutcome === 'loss') ||
                      (opponentId === user.id && state.diceOutcome === 'win');
      
      const timer = setTimeout(() => {
        if (isWinner) {
          setPersonalOverlay({ type: 'win', amount: state.pot });
          playWinChime();
        } else if (isLoser) {
          setPersonalOverlay({ type: 'loss', amount: state.betAmount });
          playLossTone();
        } else {
          const winner = state.players.find(p => p.id === state.winnerId);
          if (winner) {
            setToasts(prev => [...prev, { id: Date.now().toString(), msg: `${winner.name} won ₹${state.pot}!`, type: 'info' }]);
          }
        }
      }, 2500);

      const hideTimer = setTimeout(() => setPersonalOverlay(null), 7500);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [state.phase, state.diceOutcome, state.winnerId, state.pot, state.betAmount, user.id, state.currentRollerId, state.currentRollerIsWinner, state.queueIds, state.players]);

  const handleLeave = () => {
    leaveRoom();
    onLeave(user.balance);
  };

  const handleSideBet = () => {
    if (!sideBetTarget) return;
    placeSideBet(sideBetTarget, sideBetAmount);
    playBetPlaced();
  };

  // Render waiting room
  if (state.phase === 'waiting') {
    return (
      <div className="screen active" id="screen-game" style={{ display: 'flex', flexDirection: 'column' }}>
        <Toast toasts={toasts} />
        <div className="game-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="btn-leave" onClick={handleLeave}>← Leave</button>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 700, color: 'var(--cream)', letterSpacing: 1 }}>
              {TABLE_NAMES[tableTier]}
            </span>
          </div>
        </div>
        
        <div className="waiting-container">
          <div className="waiting-card">
            <div className="searching-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-icon">🎲</div>
            </div>
            <h2 className="waiting-title">Awaiting Challengers</h2>
            <p className="waiting-subtitle">Minimum {MIN_PLAYERS} players required to start the round</p>
            
            <div className="waiting-slots">
              {Array.from({ length: 4 }).map((_, i) => {
                const p = state.players[i];
                return (
                  <div key={i} className={`waiting-slot ${p ? 'filled' : 'empty'}`}>
                    {p ? (
                      <div className="slot-content">
                        <div className="slot-av" style={{ backgroundColor: p.avatarColor }}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="slot-info">
                          <div className="slot-name">{p.name}</div>
                          <div className="slot-status">READY</div>
                        </div>
                      </div>
                    ) : (
                      <div className="slot-empty-content">
                        <div className="slot-av-placeholder">?</div>
                        <div className="slot-status">WAITING...</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="waiting-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(state.players.length / MIN_PLAYERS) * 100}%` }}></div>
              </div>
              <div className="progress-text">
                {state.players.length} / {MIN_PLAYERS} Players Joined
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active game UI
  const amISpectator = !winnerPlayer?.isMe && !challengerPlayer?.isMe;

  return (
    <div className="screen active" id="screen-game" style={{ display: 'flex', flexDirection: 'column' }}>
      <Toast toasts={toasts} />
      
      <div className="game-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn-leave" onClick={handleLeave}>← Leave</button>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 700, color: 'var(--cream)', letterSpacing: 1 }}>
            {TABLE_NAMES[tableTier]}
          </span>
        </div>
        <div className="game-pot-display">
          <div className="game-pot-label">Total Pot</div>
          <div className="game-pot-val">₹{state.pot.toLocaleString()}</div>
        </div>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: 'var(--text3)' }}>
          Bet: <span style={{ color: 'var(--gold2)', fontWeight: 700 }}>₹{betAmount}</span>
        </div>
      </div>

      <div className="game-layout" style={{ flex: 1, minHeight: 0 }}>
        <div className="game-main">
          <div id="game-active-area" style={{ width: '100%', maxWidth: 640 }}>
            <div className="casino-table-outer">
              <div className="casino-table-rim">
                <div className="casino-table-felt" ref={feltRef}>
                  
                  <div className="dice-center-zone">
                    <div className="dice-throw-wrapper" id="dice-throw-wrapper" ref={wrapperRef}>
                      <div className="dice-area">
                        <div className="die-wrap">
                          <div className="die-label-text">Die One</div>
                          <div className="dice-scene">
                            <Dice 
                              face={state.die1 || 1} 
                              rolling={state.phase === 'rolling'} 
                              id="die1"
                              outcome={state.diceOutcome === 'win' ? 'show-win' : state.diceOutcome === 'loss' ? 'show-lose' : ''} 
                            />
                          </div>
                          <div className={`die-shadow-el ${state.phase === 'rolling' ? 'rolling-shadow' : ''}`} id="die1-shadow"></div>
                          <div className={`die-result-val ${state.diceOutcome === 'win' ? 'win-color' : state.diceOutcome === 'loss' ? 'lose-color' : ''}`} id="die1-val">
                            {state.die1 ? state.die1 : '—'}
                          </div>
                        </div>
                        <div className="die-wrap">
                          <div className="die-label-text">Die Two</div>
                          <div className="dice-scene">
                            <Dice 
                              face={state.die2 || 1} 
                              rolling={state.phase === 'rolling'} 
                              id="die2"
                              outcome={state.diceOutcome === 'win' ? 'show-win' : state.diceOutcome === 'loss' ? 'show-lose' : ''} 
                            />
                          </div>
                          <div className={`die-shadow-el ${state.phase === 'rolling' ? 'rolling-shadow' : ''}`} id="die2-shadow"></div>
                          <div className={`die-result-val ${state.diceOutcome === 'win' ? 'win-color' : state.diceOutcome === 'loss' ? 'lose-color' : ''}`} id="die2-val">
                            {state.die2 ? state.die2 : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                    {state.diceOutcome && (
                      <div className={`result-msg ${state.diceOutcome === 'win' ? 'result-win-msg' : state.diceOutcome === 'loss' ? 'result-lose-msg' : 'result-neutral-msg'}`}>
                        {state.diceOutcome.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="vs-overlay">
                    <span className="vs-name">{winnerPlayer?.name || '—'}</span>
                    <span className="vs-sep">VS</span>
                    <span className="vs-name">{challengerPlayer?.name || '—'}</span>
                  </div>

                  {/* Player Seats */}
                  <div className="game-players-row" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none' }}>
                    {state.players.map((p) => {
                      const pos = playerAngles[p.id] || { x: 50, y: 50 };
                      
                      const isRoller = state.currentRollerId === p.id;
                      const isWinner = state.winnerId === p.id;
                      const isChall = state.queueIds[0] === p.id;
                      const roleClass = isRoller && (state.phase === 'playing' || state.phase === 'rolling') ? 'rolling' : (isWinner || isChall) ? 'playing' : '';
                      const winnerClass = state.phase === 'between' && state.lastWinnerId === p.id ? 'winner-card' : state.phase === 'between' && state.lastLoserId === p.id ? 'loser-card' : '';
                      
                      const qIdx = state.queueIds.indexOf(p.id);
                      let roleLabel = '';
                      if (isRoller) roleLabel = 'Rolling';
                      else if (isWinner || isChall) roleLabel = 'In Play';
                      else if (qIdx >= 0) roleLabel = `#${qIdx + 1}`;
                      else roleLabel = 'Watching';

                      return (
                        <div 
                          key={p.id} 
                          className="player-seat" 
                          style={{ left: `${pos.x.toFixed(2)}%`, top: `${pos.y.toFixed(2)}%`, pointerEvents: 'auto' }}
                        >
                          <div className={`seat-card ${roleClass} ${winnerClass}`}>
                            {qIdx >= 0 && !isChall && <div className="queue-badge">{qIdx + 1}</div>}
                            <div className="seat-av" style={{ backgroundColor: p.avatarColor }}>
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="seat-name">{p.name}</div>
                            <div className="seat-balance">₹{p.balance}</div>
                            <div className="seat-stats">
                              <span style={{ color: '#6fcf97' }}>W: {p.wins}</span>
                              <span style={{ margin: '0 4px', opacity: 0.3 }}>|</span>
                              <span style={{ color: '#ff8a80' }}>L: {p.losses}</span>
                            </div>
                            <div className={`seat-role ${isRoller ? 'role-rolling' : (isWinner || isChall) ? 'role-playing' : 'role-waiting'}`}>{roleLabel}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Throw Canvas for Golden Trail */}
                  <canvas ref={canvasRef} id="throw-canvas" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', zIndex: 25, width: '100%', height: '100%' }}></canvas>
                </div>
              </div>
            </div>

            <div className="table-controls">
              <button 
                className="btn-roll" 
                onClick={() => {
                  console.log('Button clicked in GameTable');
                  roll();
                }} 
                disabled={!isMyTurn || state.phase === 'rolling' || state.phase === 'result'}
              >
                ROLL THE DICE
              </button>
              <div className="roller-hint">
                {isMyTurn ? 'Your turn to roll!' : currentRoller ? `Waiting for ${currentRoller.name}...` : '...'}
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="game-sidebar">
          {personalOverlay && (
            <div className={`personal-overlay ${personalOverlay.type === 'win' ? 'overlay-win' : 'overlay-loss'}`}>
              <div className="overlay-content">
                <div className="overlay-title">{personalOverlay.type === 'win' ? 'VICTORY' : 'DEFEAT'}</div>
                <div className="overlay-amount">
                  {personalOverlay.type === 'win' ? `+₹${personalOverlay.amount}` : `-₹${personalOverlay.amount}`}
                </div>
                <div className="overlay-sub">{personalOverlay.type === 'win' ? 'The table is yours!' : 'Better luck next roll.'}</div>
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-title">Table Info</div>
            <div className="info-display">
              <div className="info-row"><span>Tier</span><span style={{ color: 'var(--gold2)', textTransform: 'capitalize' }}>{state.tableTier}</span></div>
              <div className="info-row"><span>Entry Bet</span><span style={{ color: '#6fcf97' }}>₹{state.betAmount}</span></div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">Pot</div>
            <div className="pot-display">
              <div className="pot-box"><div className="pot-val">₹{state.pot}</div><div className="pot-lbl">Main</div></div>
              <div className="pot-box"><div className="pot-val" style={{ color: '#bb8fce' }}>₹{state.sidePot}</div><div className="pot-lbl">Side</div></div>
            </div>
          </div>

          {amISpectator && (
            <div className="sidebar-section">
              <div className="sidebar-title">Your Side Bet</div>
              <div className="spec-pick-row">
                <button 
                  className={`spec-pick ${sideBetTarget === winnerPlayer?.id ? 'picked-a' : ''}`}
                  onClick={() => setSideBetTarget(winnerPlayer?.id || '')}
                  disabled={!winnerPlayer}
                >
                  On {winnerPlayer?.name.split(' ')[0]}
                </button>
                <button 
                  className={`spec-pick ${sideBetTarget === challengerPlayer?.id ? 'picked-b' : ''}`}
                  onClick={() => setSideBetTarget(challengerPlayer?.id || '')}
                  disabled={!challengerPlayer}
                >
                  On {challengerPlayer?.name.split(' ')[0]}
                </button>
              </div>
              <div className="spec-amt-row">
                <input 
                  type="number" 
                  value={sideBetAmount} 
                  onChange={e => setSideBetAmount(parseInt(e.target.value) || 0)} 
                  min={10} 
                  step={10} 
                />
                <button className="spec-place-btn" onClick={handleSideBet} disabled={!sideBetTarget}>
                  PLACE BET
                </button>
              </div>
            </div>
          )}

          <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-title">Live Feed</div>
            <div className="notif-list" style={{ flex: 1, overflowY: 'auto' }}>
              {state.notifications.map((n, i) => (
                <div key={i} className={`notif-item notif-${n.type}`}>
                  <div>{n.msg}</div>
                  <div className="notif-time">{n.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY */}
      {state.phase === 'between' && state.lastWinnerId && (
        <div className="overlay active">
          {isMounted && state.lastWinnerId === user.id && (
            <div className="confetti-container">
              {Array.from({ length: 40 }).map((_, i) => (
                <div 
                  key={i} 
                  className="cpiece" 
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#f1c40f', '#e67e22', '#e74c3c', '#2ecc71', '#3498db'][Math.floor(Math.random() * 5)],
                    width: `${5 + Math.random() * 8}px`,
                    height: `${5 + Math.random() * 12}px`,
                    animationDuration: `${1.5 + Math.random() * 2}s`,
                    animationDelay: `${Math.random() * 0.5}s`
                  }}
                />
              ))}
            </div>
          )}
          <div className="overlay-box" style={{ animation: 'pop-in 0.4s ease' }}>
            <span className="overlay-icon">{state.lastWinnerId === user.id ? '👑' : '💸'}</span>
            <div className={`overlay-title ${state.lastWinnerId === user.id ? 'result-win-msg' : 'result-lose-msg'}`}>
              {state.lastWinnerId === user.id ? 'YOU WON' : 'ROUND ENDED'}
            </div>
            <div className="overlay-divider"></div>
            <div className="overlay-amount">₹{state.lastWinAmount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
