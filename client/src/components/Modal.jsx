import { useEffect, useRef, useState } from 'react';

/**
 * Presentational modal shell. Rendered by ModalProvider — don't use directly,
 * use `useModal()` (confirmDialog / promptDialog) from components/pages instead.
 */
export default function Modal({
  type = 'confirm',
  title,
  message,
  variant = 'primary',
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  defaultValue = '',
  inputType = 'text',
  placeholder = '',
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(defaultValue);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // mount-in transition
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (type === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmBtnRef.current?.focus();
    }
  }, [type]);

  function handleConfirmClick() {
    if (type === 'prompt') onConfirm(value);
    else onConfirm();
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && type !== 'prompt') handleConfirmClick();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel, type]);

  const confirmColor =
    variant === 'danger'
      ? 'bg-danger hover:bg-red-700 focus-visible:ring-danger'
      : 'bg-primary hover:bg-blue-700 focus-visible:ring-primary';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onCancel} />

      <div
        className={`relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 transition-all duration-150 ${
          visible ? 'translate-y-0 scale-100' : 'translate-y-2 scale-95'
        }`}
      >
        <h3 id="modal-title" className="text-lg font-semibold text-navy mb-2">
          {title}
        </h3>
        {message && <p className="text-sm text-body mb-4 leading-relaxed">{message}</p>}

        {type === 'prompt' && (
          <input
            ref={inputRef}
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmClick();
            }}
            className="w-full border border-border rounded-md px-3 py-2 text-sm text-navy mb-5 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-body border border-border hover:bg-background transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirmClick}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
