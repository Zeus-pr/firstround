'use client';

import { useState } from 'react';
import type { ReviewDraft } from '@/lib/jobs';
import { NaukriMark } from './NaukriMark';

type Props = {
  drafts: ReviewDraft[];
  busyId?: string | null;
  shuffle?: boolean;
  onShuffle?: (on: boolean) => void;
  onApprove?: (draftId: string) => void;
  onSave?: (draftId: string, subject: string, body: string) => void;
  onCancel?: (draftId: string) => void;
};

export function DraftLetters({
  drafts,
  busyId = null,
  shuffle = true,
  onShuffle,
  onApprove,
  onSave,
  onCancel,
}: Props) {
  const pending = drafts.filter((d) => d.status === 'pending_approval').slice(0, 10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; subject: string; body: string } | null>(null);
  const [busyKind, setBusyKind] = useState<'approve' | 'save' | 'cancel' | null>(null);

  return (
    <div className="desk-letters-wrap">
      <div className="desk-shuffle">
        <p>Use a different subject line on each letter.</p>
        <button
          type="button"
          className={`desk-switch${shuffle ? ' is-on' : ''}`}
          aria-pressed={shuffle}
          onClick={() => onShuffle?.(!shuffle)}
        >
          <span className="desk-switch-knob" aria-hidden="true" />
          {shuffle ? 'On' : 'Off'}
        </button>
      </div>
      {pending.length === 0 ? (
        <p className="desk-pane-copy">No letters waiting. Start my round when you’re ready.</p>
      ) : (
        <ul className="desk-letters" aria-label="Draft letters">
          {pending.map((draft) => {
            const open = openId === draft.id;
            const editing = edit?.id === draft.id;
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
                    <span className="desk-letter-company">
                      <NaukriMark />
                      {company}
                    </span>
                    <span className="desk-letter-role">{draft.subject?.trim() || role}</span>
                  </span>
                  <span className="desk-letter-chevron" aria-hidden="true" />
                </button>
                {open ? (
                  <div className="desk-letter-panel">
                    {editing ? (
                      <>
                        <label className="desk-field">
                          <span>Subject</span>
                          <input
                            value={edit.subject}
                            onChange={(event) => setEdit({ ...edit, subject: event.target.value })}
                          />
                        </label>
                        <label className="desk-field">
                          <span>Letter</span>
                          <textarea
                            className="desk-letter-edit"
                            rows={12}
                            value={edit.body}
                            onChange={(event) => setEdit({ ...edit, body: event.target.value })}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        {draft.subject ? (
                          <p className="desk-letter-subject">{draft.subject}</p>
                        ) : null}
                        <pre className="desk-letter-body">{draft.body}</pre>
                      </>
                    )}
                    <div className="desk-letter-actions">
                      {editing ? (
                        <button
                          type="button"
                          className="wax desk-letter-approve"
                          disabled={
                            busyId === draft.id || !edit.subject.trim() || !edit.body.trim()
                          }
                          onClick={() => {
                            setBusyKind('save');
                            onSave?.(draft.id, edit.subject.trim(), edit.body);
                          }}
                        >
                          {busyId === draft.id && busyKind === 'save' ? 'Saving…' : 'Save'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="wax desk-letter-approve"
                          disabled={busyId === draft.id}
                          onClick={() => {
                            setBusyKind('approve');
                            onApprove?.(draft.id);
                          }}
                        >
                          {busyId === draft.id && busyKind === 'approve'
                            ? 'Approving…'
                            : 'Approve letter'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        disabled={busyId === draft.id}
                        onClick={() =>
                          setEdit(
                            editing
                              ? null
                              : { id: draft.id, subject: draft.subject ?? '', body: draft.body },
                          )
                        }
                      >
                        {editing ? 'Close editor' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busyId === draft.id}
                        onClick={() => {
                          setBusyKind('cancel');
                          onCancel?.(draft.id);
                        }}
                      >
                        {busyId === draft.id && busyKind === 'cancel'
                          ? 'Cancelling…'
                          : 'Cancel letter'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
