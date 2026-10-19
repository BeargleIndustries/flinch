import { redirect } from '@sveltejs/kit';

// "/data" has no screen of its own (brief 4.2): open its first sub-tab.
export function load(): never {
  redirect(307, '/data/browse');
}
