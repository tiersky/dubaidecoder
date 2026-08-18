import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { listVersions } from '@/lib/versions/store';
import { UploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const versions = await listVersions();
  const existingSlugs = versions
    .filter((v) => v.status === 'published')
    .map((v) => v.slug);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-lg p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Upload workbook</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          Add a new decoder version or refresh an existing one
        </p>

        <UploadForm existingSlugs={existingSlugs} />
      </div>
    </main>
  );
}
