import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { emptyState } from '@/lib/builder/build';
import Builder from '@/components/builder/Builder';

export const dynamic = 'force-dynamic';

export default async function NewDecoderPage() {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');
  return (
    <main className="min-h-screen">
      <Builder initial={emptyState()} resumeLocal />
    </main>
  );
}
