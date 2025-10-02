import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  credits: number;
}

interface UseUserReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useUser(): UseUserReturn {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setUser(null);
      setError(null);
      return;
    }

    if (session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || undefined,
        role: session.user.role || 'USER',
        credits: session.user.credits || 0,
      });
      setError(null);
    }
  }, [session, status]);

  return {
    user,
    loading: status === 'loading',
    error,
  };
}