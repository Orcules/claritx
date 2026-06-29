import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

export function useUserRole() {
  const [role, setRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.accessToken?.payload['cognito:groups'] as string[] | undefined;

        if (groups && groups.includes('Admins')) {
          setRole('admin');
          setIsAdmin(true);
        } else {
          setRole('user');
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Failed to get user role:', error);
        setRole('user');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, []);

  return {
    role,
    loading,
    isAdmin,
  };
}