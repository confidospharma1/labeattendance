'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

/** Entry point: send the user to the right screen for their role. */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') router.replace('/admin');
    else router.replace('/employee');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-700 text-white gap-4">
      <div className="w-14 h-14 rounded-2xl bg-white text-brand-700 flex items-center justify-center font-black text-2xl">L</div>
      <Loader2 className="w-6 h-6 animate-spin text-brand-100" />
    </div>
  );
}
