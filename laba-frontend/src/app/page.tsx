'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { Logo } from '@/components/common/Logo';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white gap-5">
      <Logo light size={56} subtitle="Attendance & field tracking" />
      <Loader2 className="w-6 h-6 animate-spin text-brand-100" />
    </div>
  );
}
