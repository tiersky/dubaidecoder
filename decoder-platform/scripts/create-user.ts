import { serviceClient } from '../lib/supabase/admin';
import { createViewer } from '../lib/users/admin';

async function main() {
  const [email, password, role, ...slugs] = process.argv.slice(2);
  if (!email || !password || (role !== 'admin' && role !== 'viewer')) {
    console.error('usage: create-user.ts <email> <password> <admin|viewer> [slug ...]');
    process.exit(1);
  }

  if (role === 'viewer') {
    const user = await createViewer({ email, password, slugs });
    console.log(`created ${role} ${email} (id ${user.id}) slugs=[${slugs.join(', ')}]`);
  } else {
    // admins stay script-only, deliberate act
    const db = serviceClient();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, allowed_slugs: [] },
    });
    if (error) throw new Error(error.message);
    console.log(`created ${role} ${email} (id ${data.user?.id}) slugs=[${slugs.join(', ')}]`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
