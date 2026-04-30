import React from 'react';
import { X } from '../icons/index.js';
import type { OptionGroup } from './OptionGroup.js';
import { inputStyle } from './TextInput.js';

export function FilteredGroupedSelect({
  value,
  onChange,
  groups,
  placeholder,
  clearable,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: OptionGroup[];
  placeholder?: string;
  clearable?: boolean;
}) {
  const [filterText, setFilterText] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Build flat filtered options
  const flatOptions = React.useMemo(() => {
    const lower = filterText.toLowerCase();
    const result: Array<{ group: string; option: string }> = [];
    for (const g of groups) {
      for (const o of g.options) {
        if (!filterText || o.toLowerCase().includes(lower)) {
          result.push({ group: g.label, option: o });
        }
      }
    }
    return result;
  }, [groups, filterText]);

  // Build filtered groups for display
  const filteredGroups = React.useMemo(() => {
    const lower = filterText.toLowerCase();
    return groups.map((g) => ({
      ...g,
      options: filterText ? g.options.filter((o) => o.toLowerCase().includes(lower)) : g.options,
    })).filter((g) => g.options.length > 0);
  }, [groups, filterText]);

  const open = () => {
    setFilterText('');
    setFocusedIndex(-1);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const selectOption = (opt: string) => {
    onChange(opt);
    close();
  };

  const clearValue = () => {
    setFilterText('');
    onChange('');
    close();
  };

  // Click outside detection
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        open();
        return;
      }
      return;
    }
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, flatOptions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < flatOptions.length) {
        selectOption(flatOptions[focusedIndex].option);
      } else {
        // Allow free text entry
        onChange(filterText);
        close();
      }
      return;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only close if focus leaves the wrapper entirely
    if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget as Node)) return;
    if (!isOpen) return;
    // commit free-typed value on blur
    if (filterText !== value) {
      onChange(filterText);
    }
    close();
  };

  // Compute flat index for a given group/option combo
  const getFlatIndex = (groupLabel: string, opt: string) => {
    return flatOptions.findIndex((f) => f.group === groupLabel && f.option === opt);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }} tabIndex={-1}>
      <input
        style={{
          ...inputStyle,
          ...(clearable && value ? { paddingRight: 22 } : {}),
        }}
        value={isOpen ? filterText : (value || '')}
        placeholder={placeholder ?? ''}
        onChange={(e) => setFilterText(e.target.value)}
        onFocus={open}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {!!(clearable && value) && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearValue();
          }}
          title="Clear"
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 16,
            borderRadius: 3,
            border: '1px solid #334155',
            background: '#0f172a',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: '14px',
            padding: 0,
          }}
          onMouseDown={(e) => e.preventDefault()} // don't steal focus / blur input
        >
          <X size={12} />
        </button>
      )}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 4,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
          onMouseDown={(e) => e.preventDefault()} // prevent blur on option click
        >
          {filteredGroups.length === 0 ? (
            <div style={{ padding: '6px 10px', fontSize: 11, color: '#475569' }}>
              No options
            </div>
          ) : (
            filteredGroups.map((g) => (
              <div key={g.label}>
                <div
                  style={{
                    padding: '4px 8px 2px',
                    fontSize: 9,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontFamily: 'var(--font-family-mono)',
                  }}
                >
                  {g.label}
                  {filterText && ` (${g.options.length})`}
                </div>
                {g.options.map((o) => {
                  const flatIdx = getFlatIndex(g.label, o);
                  const isFocused = flatIdx === focusedIndex;
                  return (
                    <div
                      key={o}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        background: isFocused ? '#334155' : 'transparent',
                        fontFamily: 'var(--font-family-mono)',
                      }}
                      onMouseEnter={() => setFocusedIndex(flatIdx)}
                      onMouseLeave={() => setFocusedIndex(-1)}
                      onClick={() => selectOption(o)}
                    >
                      {o}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
