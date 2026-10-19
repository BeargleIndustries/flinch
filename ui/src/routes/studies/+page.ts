import { redirect } from '@sveltejs/kit';

// "/studies" has no screen of its own (brief 4.2): open its first sub-tab.
export function load(): never {
  redirect(307, '/studies/framings');
}
