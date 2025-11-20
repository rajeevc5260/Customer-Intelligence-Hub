import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Token will be in URL hash, handled client-side
  return {};
};