'use client';

import { useId, useMemo, useState } from 'react';

type Props = {
  label: string;
  placeholder?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  onAdd?: (label: string) => Promise<void> | void;
  single?: boolean;
  disabled?: boolean;
};

export function SearchMulti({
  label,
  placeholder = 'Search or add',
  options,
  value,
  onChange,
  onAdd,
  single = false,
  disabled = false,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((option) => !value.some((picked) => picked.toLowerCase() === option.toLowerCase()))
      .filter((option) => (q ? option.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [options, query, value]);

  const exact = options.some((option) => option.toLowerCase() === query.trim().toLowerCase());
  const canAdd =
    query.trim().length >= 2 &&
    !exact &&
    !value.some((v) => v.toLowerCase() === query.trim().toLowerCase());

  function pick(option: string) {
    onChange(single ? [option] : [...value, option]);
    setQuery('');
    setOpen(false);
  }

  function remove(option: string) {
    onChange(value.filter((item) => item !== option));
  }

  async function addCustom() {
    const label = query.trim();
    if (!canAdd || !onAdd) return;
    setAdding(true);
    try {
      await onAdd(label);
      pick(label);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="desk-pick">
      <span className="desk-pick-label" id={listId}>
        {label}
      </span>
      {value.length > 0 ? (
        <ul className="desk-pick-chips" aria-label={`${label} selected`}>
          {value.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="desk-chip"
                disabled={disabled}
                onClick={() => remove(item)}
              >
                {item}
                <span aria-hidden="true"> ×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        aria-labelledby={listId}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (matches[0] && query.trim()) pick(matches[0]);
            else if (canAdd) void addCustom();
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      />
      {open && (matches.length > 0 || canAdd) ? (
        <ul className="desk-pick-menu" role="listbox" aria-labelledby={listId}>
          {matches.map((option) => (
            <li key={option}>
              <button type="button" role="option" aria-selected={false} onClick={() => pick(option)}>
                {option}
              </button>
            </li>
          ))}
          {canAdd ? (
            <li>
              <button
                type="button"
                className="desk-pick-add"
                disabled={adding || !onAdd}
                onClick={() => void addCustom()}
              >
                {adding ? 'Adding…' : `Add “${query.trim()}” to the list`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
