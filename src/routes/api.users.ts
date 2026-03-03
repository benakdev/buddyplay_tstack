// src/routes/api.users.ts
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async ({}) => {
        // Standard server logic here
        return new Response(JSON.stringify({ users: ['Ben', 'Alice'] }), {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      },
      POST: async ({ request }) => {
        const body = await request.json();
        return new Response(`Hello, ${body.name}!`);
      }
    }
  }
});
