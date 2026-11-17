'use client';

import { useState, useTransition } from 'react';
import { saveDraft } from '../../actions';

type Props = {
  matchId: string;
  kind: 'outreach' | 'cover';
  title: string;
  hint: string;
  subject?: string;
  body: string;
};

export default function DraftEditor({ matchId, kind, title, hint, subject: initialSubject = '', body: initialBody }: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  const save = () =>
    start(async () => {
      const res = await saveDraft(matchId, kind === 'outreach' ? { outreach_subject: subject, outreach_body: body } : { cover_note: body });
      setNote(res.error ?? 'Saved');
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(kind === 'outreach' && subject ? `Subject: ${subject}\n\n${body}` : body);
      setNote('Copied');
    } catch {
      setNote('Copy failed. Select the text and copy it manually.');
    }
  };

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <section className="card stack">
      <div>
        <h2>{title}</h2>
        <p className="hint">{hint}</p>
      </div>
      {kind === 'outreach' && (
        <label>
          Subject
          <input type="text" value={subject} onChange={(e) => { setSubject(e.target.value); setNote(''); }} />
        </label>
      )}
      <label>
        {kind === 'outreach' ? 'Message' : 'Note'}
        <textarea rows={kind === 'outreach' ? 9 : 11} value={body} onChange={(e) => { setBody(e.target.value); setNote(''); }} />
      </label>
      <div className="row spread">
        <div className="row">
          <button type="button" className="btn primary" onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save edits'}
          </button>
          <button type="button" className="btn" onClick={copy}>
            Copy
          </button>
          {kind === 'outreach' && (
            <a className="btn" href={mailto}>
              Open in mail app
            </a>
          )}
        </div>
        <span className="small muted" role="status">
          {note || `${words} words`}
        </span>
      </div>
    </section>
  );
}
