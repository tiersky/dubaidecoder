import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass materialize max-w-md rounded-[28px] px-8 py-9 text-center">
        <h1 className="display text-[22px] font-semibold text-ink">Not found</h1>
        <p className="mt-2 text-[14px] text-ink-2">No decoder is published at this address.</p>
        <Link href="/select" className="btn-secondary mt-6 px-5 py-2.5 text-[14px]">
          Your projects
        </Link>
      </div>
    </div>
  );
}
