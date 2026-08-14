export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-800">Not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          No decoder is published at this address.
        </p>
      </div>
    </div>
  );
}
