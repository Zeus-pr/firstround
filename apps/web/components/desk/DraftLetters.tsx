'use client';

import { useEffect, useState } from 'react';
import type { ReviewDraft } from '@/lib/jobs';

type Props = {
  drafts: ReviewDraft[];
  busyId?: string | null;
  onApprove?: (draftId: string) => void;
};

export function DraftLetters({ drafts, busyId = null, onApprove }: Props) {
  const pending = drafts.filter((d) => d.status === 'pending_approval');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const ids = drafts.filter((d) => d.status === 'pending_approval').map((d) => d.id);
    setOpenId((current) => {
      if (current && ids.includes(current)) return current;
      return ids[0] ?? null;
    });
  }, [drafts]);

  if (pending.length === 0) {
    return <p className="desk-pane-copy">No letters waiting. Start my round when you’re ready.</p>;
  }

  return (
    <ul className="desk-letters" aria-label="Draft letters">
      {pending.map((draft) => {
        const open = openId === draft.id;
        const company = draft.company?.trim() || 'Company';
        const role = draft.role?.trim() || 'Role';
        return (
          <li key={draft.id} className={`desk-letter${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className="desk-letter-toggle"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : draft.id)}
            >
              <span className="desk-letter-meta">
                <span className="desk-letter-company">{company}</span>
                <span className="desk-letter-role">{role}</span>
              </span>
              <span className="desk-letter-chevron" aria-hidden="true" />
            </button>
            <div className="desk-letter-panel" hidden={!open}>
              <pre className="desk-letter-body">{draft.body}</pre>
              <div className="desk-letter-actions">
                {onApprove ? (
                  <button
                    type="button"
                    className="wax desk-letter-approve"
                    disabled={busyId === draft.id}
                    onClick={() => onApprove(draft.id)}
                  >
                    {busyId === draft.id ? 'Approving…' : 'Approve letter'}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
