import { httpRouter } from 'convex/server';

import { api } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

http.route({
  path: '/admin/seed-clubs',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const headerToken = request.headers.get('x-admin-token');
    const queryToken = url.searchParams.get('token');
    const token = headerToken ?? queryToken ?? '';

    const requiredToken = process.env.ADMIN_SEED_TOKEN;
    const allowOpen = process.env.ALLOW_OPEN_SEED_ENDPOINT === 'true';

    if (!requiredToken && !allowOpen) {
      return new Response('Forbidden: Set ADMIN_SEED_TOKEN or ALLOW_OPEN_SEED_ENDPOINT=true', { status: 403 });
    }

    if (requiredToken && token !== requiredToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const syncedCount = await ctx.runMutation(api.clubs.syncClubs, {});
    return Response.json({ syncedCount });
  })
});

export default http;
