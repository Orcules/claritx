import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AuthModalOptions {
  onSuccess?: () => void;
  onDismiss?: () => void;
  title?: string;
  description?: string;
}

interface AuthModalContextValue {
  isOpen: boolean;
  openAuthModal: (opts?: AuthModalOptions) => void;
  closeAuthModal: () => void;
  pendingCallback: (() => void) | undefined;
  dismissCallback: (() => void) | undefined;
  customTitle: string | undefined;
  customDescription: string | undefined;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | undefined>(undefined);
  const [dismissCallback, setDismissCallback] = useState<(() => void) | undefined>(undefined);
  const [customTitle, setCustomTitle] = useState<string | undefined>(undefined);
  const [customDescription, setCustomDescription] = useState<string | undefined>(undefined);

  const openAuthModal = useCallback((opts?: AuthModalOptions) => {
    setPendingCallback(opts?.onSuccess ? () => opts.onSuccess! : undefined);
    setDismissCallback(opts?.onDismiss ? () => opts.onDismiss! : undefined);
    setCustomTitle(opts?.title);
    setCustomDescription(opts?.description);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsOpen(false);
    setPendingCallback(undefined);
    setDismissCallback(undefined);
    setCustomTitle(undefined);
    setCustomDescription(undefined);
  }, []);

  return (
    <AuthModalContext.Provider value={{ isOpen, openAuthModal, closeAuthModal, pendingCallback, dismissCallback, customTitle, customDescription }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}
