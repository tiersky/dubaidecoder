import { serviceClient } from '../lib/supabase/admin';

async function main() {
  const [email, password, role, ...slugs] = process.argv.slice(2);
  if (!email || !password || (role !== 'admin' && role !== 'viewer')) {
    console.error('usage: create-user.ts <email> <password> <admin|viewer> [slug ...]');
    process.exit(1);
  }
  const db = serviceClient();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, allowed_slugs: role === 'viewer' ? slugs : [] },
  });
  if (error) throw new Error(error.message);
  console.log(`created ${role} ${email} (id ${data.user?.id}) slugs=[${slugs.join(', ')}]`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
