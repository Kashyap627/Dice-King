import React from 'react';
import type { DiceFace } from '../lib/game/game';

interface DiceProps {
  face: DiceFace;
  rolling?: boolean;
  id?: string;
  outcome?: 'show-win' | 'show-lose' | '';
}

export default function Dice({ face, rolling = false, id, outcome = '' }: DiceProps) {
  // Map our numeric face to the CSS class from dhani.html
  const faceClass = `show-${face}`;
  
  // The original prototype handles rolling by adding the "rolling" class.
  const rollingClass = rolling ? ' rolling' : '';
  const outcomeClass = outcome ? ` ${outcome}` : '';

  return (
    <div className={`dice-cube ${faceClass}${rollingClass}${outcomeClass}`} id={id}>
      <div className="iface f-front">
        <div className="fdots">
          <div className="rpip rp-c"></div>
        </div>
        <span className="crown-mark">♛</span>
      </div>
      <div className="iface f-back">
        <div className="fdots">
          <div className="rpip rp-tl"></div>
          <div className="rpip rp-tr"></div>
          <div className="rpip rp-ml"></div>
          <div className="rpip rp-mr"></div>
          <div className="rpip rp-bl"></div>
          <div className="rpip rp-br"></div>
        </div>
      </div>
      <div className="iface f-right">
        <div className="fdots">
          <div className="rpip rp-tl"></div>
          <div className="rpip rp-c"></div>
          <div className="rpip rp-br"></div>
        </div>
      </div>
      <div className="iface f-left">
        <div className="fdots">
          <div className="rpip rp-tl"></div>
          <div className="rpip rp-tr"></div>
          <div className="rpip rp-bl"></div>
          <div className="rpip rp-br"></div>
        </div>
      </div>
      <div className="iface f-top">
        <div className="fdots">
          <div className="rpip rp-tl"></div>
          <div className="rpip rp-br"></div>
        </div>
      </div>
      <div className="iface f-bottom">
        <div className="fdots">
          <div className="rpip rp-tl"></div>
          <div className="rpip rp-tr"></div>
          <div className="rpip rp-bl"></div>
          <div className="rpip rp-br"></div>
          <div className="rpip rp-c"></div>
        </div>
      </div>
    </div>
  );
}
