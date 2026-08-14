import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-slate-800">Country Decoders</h1>
        <p className="mt-2 text-sm text-slate-500">
          Country decoder dashboards — access via your project link.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
