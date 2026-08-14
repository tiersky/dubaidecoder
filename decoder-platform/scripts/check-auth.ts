import { createClient } from '@supabase/supabase-js';

async function main() {
  const [email, password, expectedRole, expectedSlug] = process.argv.slice(2);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const meta = data.user?.app_metadata as { role?: string; allowed_slugs?: string[] };
  if (meta?.role !== expectedRole) throw new Error(`role: expected ${expectedRole}, got ${meta?.role}`);
  if (expectedSlug && !meta?.allowed_slugs?.includes(expectedSlug))
    throw new Error(`allowed_slugs missing ${expectedSlug}: ${JSON.stringify(meta?.allowed_slugs)}`);
  await supabase.auth.signOut();
  console.log(`auth OK: ${email} role=${meta.role} slugs=${JSON.stringify(meta.allowed_slugs)}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
