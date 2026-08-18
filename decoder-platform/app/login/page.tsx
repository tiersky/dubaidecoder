import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { postLoginPath } from '@/lib/auth/post-login';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const access = await getAccess();
  if (access) redirect(postLoginPath(access, next ?? null));

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Country Decoder</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          Sign in to view your dashboard
        </p>

        <LoginForm next={next ?? ''} />
      </div>
    </main>
  );
}
