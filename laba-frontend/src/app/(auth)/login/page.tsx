'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/providers/AuthProvider';
import { Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await login(data);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-white border border-[#E5E5E5] rounded-lg shadow-sm p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-[#171717] text-white flex items-center justify-center rounded font-bold text-lg">
            L
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#171717]">LABA Sign In</h1>
            <p className="text-xs text-[#737373]">Employee & Administrative Attendance Portal</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#737373]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                {...register('email')}
                placeholder="employee@laba.in"
                disabled={submitting}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#171717] text-[#171717] placeholder:text-[#737373]/60 transition-colors"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#737373]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#171717] text-[#171717] placeholder:text-[#737373]/60 transition-colors"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-[#171717] hover:bg-[#333333] text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verifying Credentials...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-[#E5E5E5] text-center text-xs text-[#737373]">
          GPS location will be verified against authorized geofences upon check-in.
        </div>
      </div>
    </div>
  );
}

