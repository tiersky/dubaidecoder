import Image from 'next/image';
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
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="glass materialize w-full max-w-[380px] rounded-[28px] px-7 pb-8 pt-9 sm:px-9">
        <div className="flex flex-col items-center text-center">
          <h1>
            <Image
              src="/brand/country-decoder-lockup-stacked-black.svg"
              alt="Country Decoder"
              width={152}
              height={92}
              className="h-[92px] w-auto"
              priority
            />
          </h1>
          <p className="mt-5 text-[14px] text-ink-2">Sign in to view your dashboard</p>
        </div>

        <LoginForm next={next ?? ''} />
      </div>
    </main>
  );
}
