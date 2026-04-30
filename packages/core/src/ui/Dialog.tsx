import React from 'react';
import ReactDOM from 'react-dom';
import { X } from './icons/index.js';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Override body padding (default: '20px 18px'). */
  bodyStyle?: React.CSSProperties;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return ReactDOM.createPortal(<DialogInner {...props} />, document.body);
}

function DialogInner({
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  bodyStyle,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Focus management: save previously focused element, move focus into dialog on mount
  React.useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else if (!dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus();
    }
    return () => {
      if (prevFocused && document.body.contains(prevFocused)) {
        prevFocused.focus();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  React.useEffect(() => {
    if (!closeOnEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeOnEscape, onClose]);

  // Tab focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null || n === el,
    );
    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  };

  return (
    <div className="lm-dialog-overlay" onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`lm-dialog lm-dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="lm-dialog__header">
          <div>
            <h2 id={titleId} className="lm-dialog__title">{title}</h2>
            {description && <p className="lm-dialog__desc">{description}</p>}
          </div>
          <button className="lm-dialog__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="lm-dialog__body" style={bodyStyle}>{children}</div>
        {footer != null && <div className="lm-dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
