import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/Modal';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState(null);
  const resolverRef = useRef(null);

  const closeModal = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setModalState(null);
  }, []);

  /**
   * Drop-in replacement for window.confirm().
   * await confirmDialog({ title, message, variant: 'danger' | 'primary', confirmLabel, cancelLabel })
   * Resolves to true/false.
   */
  const confirmDialog = useCallback(
    ({ title, message, confirmLabel = 'Ya', cancelLabel = 'Batal', variant = 'primary' }) => {
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setModalState({ type: 'confirm', title, message, confirmLabel, cancelLabel, variant });
      });
    },
    []
  );

  /**
   * Drop-in replacement for window.prompt().
   * await promptDialog({ title, message, defaultValue, inputType, confirmLabel, cancelLabel, placeholder })
   * Resolves to the entered string, or null if cancelled.
   */
  const promptDialog = useCallback(
    ({
      title,
      message,
      defaultValue = '',
      inputType = 'text',
      confirmLabel = 'Simpan',
      cancelLabel = 'Batal',
      placeholder = '',
    }) => {
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setModalState({
          type: 'prompt',
          title,
          message,
          defaultValue,
          inputType,
          confirmLabel,
          cancelLabel,
          placeholder,
        });
      });
    },
    []
  );

  return (
    <ModalContext.Provider value={{ confirmDialog, promptDialog }}>
      {children}
      {modalState && (
        <Modal
          {...modalState}
          onCancel={() => closeModal(modalState.type === 'prompt' ? null : false)}
          onConfirm={(value) => closeModal(modalState.type === 'prompt' ? value : true)}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}
