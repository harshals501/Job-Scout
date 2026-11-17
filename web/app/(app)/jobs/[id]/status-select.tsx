'use client';

import { useState, useTransition } from 'react';
import { updateStatus } from '../../actions';
import { STATUSES } from '@/lib/labels';

export default function StatusSelect({ matchId, status }: { matchId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <label className="row" style={{ display: 'flex' }}>
      <span className="small muted">Status</span>
      <select
        value={value}
        disabled={pending}
        style={{ width: 'auto' }}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError('');
          start(async () => {
            const res = await updateStatus(matchId, next);
            if (res.error) {
              setValue(prev);
              setError(res.error);
            }
          });
        }}
      >
        {STATUSES.map(([s, label]) => (
          <option key={s} value={s}>
            {label}
          </option>
        ))}
      </select>
      {error && (
        <span className="small" role="alert" style={{ color: 'var(--bad-ink)' }}>
          {error}
        </span>
      )}
    </label>
  );
}
