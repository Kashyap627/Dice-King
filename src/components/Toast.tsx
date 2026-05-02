import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  msg: string;
  type: 'win' | 'loss' | 'bet' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
}

export default function Toast({ toasts }: ToastProps) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
