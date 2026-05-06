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
  const [visibleToasts, setVisibleToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setVisibleToasts(toasts);
    const timers = toasts.map(t => setTimeout(() => {
      setVisibleToasts(prev => prev.filter(v => v.id !== t.id));
    }, 3000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <div className="toast-container">
      {visibleToasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
