import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="materialize flex max-w-md flex-col items-center text-center">
        <Image
          src="/Country Decoder Logo.png"
          alt="Country Decoder"
          width={208}
          height={80}
          className="h-20 w-auto drop-shadow-[0_8px_24px_rgba(0,60,140,0.18)]"
          priority
        />
        <h1 className="display mt-6 text-[40px] font-semibold text-ink sm:text-[48px]">Country Decoders</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
          Country decoder dashboards — access via your project link.
        </p>
        <Link href="/login" className="btn-primary mt-8 px-7 py-3 text-[15px]">
          Sign in
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </main>
  );
}
