import React from 'react';
import type { DiceFace } from '../lib/game';

interface PipLayoutProps {
  face: DiceFace;
  size?: 'sm' | 'md' | 'lg';
}

function Pip({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  return (
    <div
      className="pip"
      style={{
        width: s, height: s,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #4a3520, #2a1a0a)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
        border: '0.5px solid rgba(0,0,0,0.3)',
        alignSelf: 'center',
        justifySelf: 'center',
      }}
    />
  );
}

function PipLayout({ face, size = 'md' }: PipLayoutProps) {
  const pad = size === 'sm' ? 5 : size === 'lg' ? 10 : 8;

  if (face === 1) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: pad,
        flexDirection: 'column',
        gap: 4,
      }}>
        <span className="crown-mark" style={{ fontSize: size === 'sm' ? 14 : size === 'lg' ? 24 : 18 }}>♛</span>
        <Pip size={size} />
      </div>
    );
  }

  if (face === 3) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        width: '100%',
        height: '100%',
        padding: pad,
        gap: 3,
      }}>
        {/* Row 1: left pip */}
        <Pip size={size} />
        <div />
        {/* Row 2: center pip (span both cols) */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
          <Pip size={size} />
        </div>
        {/* Row 3: right pip */}
        <div />
        <Pip size={size} />
      </div>
    );
  }

  if (face === 4) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        width: '100%',
        height: '100%',
        padding: pad,
        gap: 3,
      }}>
        <Pip size={size} />
        <Pip size={size} />
        <Pip size={size} />
        <Pip size={size} />
      </div>
    );
  }

  // face === 6
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr 1fr',
      width: '100%',
      height: '100%',
      padding: pad,
      gap: 3,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Pip key={i} size={size} />
      ))}
    </div>
  );
}

interface DiceProps {
  face: DiceFace;
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const DICE_SIZES = {
  sm: { w: 36, h: 50, depth: 18 },
  md: { w: 52, h: 72, depth: 26 },
  lg: { w: 68, h: 94, depth: 34 },
};

export default function Dice({ face, rolling = false, size = 'md' }: DiceProps) {
  const { w, h, depth } = DICE_SIZES[size];
  const faceStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg, #faf7f0, #f5f0e8, #ede5d0)',
    border: '1px solid #c8b89a',
    boxShadow: 'inset 0 0 8px rgba(0,0,0,0.08)',
    position: 'absolute',
  };

  // Rotation to show the correct face
  // Front face shows "face" value
  const faceRotations: Record<DiceFace, string> = {
    1: 'rotateY(0deg)',
    3: 'rotateY(90deg)',
    4: 'rotateY(-90deg)',
    6: 'rotateY(180deg)',
  };

  const baseTransform = rolling ? '' : faceRotations[face];

  return (
    <div className="dice-scene" style={{ perspective: 400, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: w,
          height: h,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: baseTransform,
          transition: rolling ? 'none' : 'transform 0.5s ease',
          animation: rolling ? `diceRoll 0.6s ease-in-out` : 'none',
        }}
      >
        {/* Front — face 1 */}
        <div style={{ ...faceStyle, width: w, height: h, transform: `translateZ(${depth}px)` }}>
          <PipLayout face={1} size={size} />
        </div>
        {/* Back — face 6 */}
        <div style={{ ...faceStyle, width: w, height: h, transform: `translateZ(-${depth}px) rotateY(180deg)` }}>
          <PipLayout face={6} size={size} />
        </div>
        {/* Left — face 3 */}
        <div style={{ ...faceStyle, width: w, height: h, transform: `translateX(-${depth}px) rotateY(-90deg)` }}>
          <PipLayout face={3} size={size} />
        </div>
        {/* Right — face 4 */}
        <div style={{ ...faceStyle, width: w, height: h, transform: `translateX(${depth}px) rotateY(90deg)` }}>
          <PipLayout face={4} size={size} />
        </div>
        {/* Top */}
        <div style={{ ...faceStyle, width: w, height: depth * 2, transform: `translateY(-${h / 2}px) rotateX(90deg)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
            <span style={{ fontSize: 8, color: '#2a1a0a', fontFamily: 'Cinzel, serif' }}>RR</span>
          </div>
        </div>
        {/* Bottom */}
        <div style={{ ...faceStyle, width: w, height: depth * 2, transform: `translateY(${h / 2}px) rotateX(-90deg)` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
            <span style={{ fontSize: 8, color: '#2a1a0a', fontFamily: 'Cinzel, serif' }}>RR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
