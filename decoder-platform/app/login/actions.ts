'use server';

import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { parseAccess } from '@/lib/auth/access';

export interface LoginState {
  error?: string;
}

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Invalid email or password' };
  }

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Never echo raw Supabase errors (they can reveal whether an account exists).
    return { error: 'Invalid email or password' };
  }

  const { data } = await supabase.auth.getClaims();
  const access = parseAccess(data?.claims);

  if (access.role === 'admin') {
    redirect('/admin');
  }
  if (access.role === 'viewer' && access.slugs.length === 1) {
    redirect('/' + access.slugs[0]);
  }
  redirect('/select');
}
