# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// convex/myFunctions.ts
import { z } from 'zod';

import { zQuery } from './lib/zod';

export const myQueryFunction = zQuery({
  // Validators for arguments.
  args: {
    first: z.number(),
    second: z.string()
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query('tablename').collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  }
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: 'hello'
});
```

A mutation function looks like:

```ts
// convex/myFunctions.ts
import { z } from 'zod';

import { zMutation } from './lib/zod';

export const myMutationFunction = zMutation({
  // Validators for arguments.
  args: {
    first: z.string(),
    second: z.string()
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert('messages', message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get('messages', id);
  }
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: 'Hello!', second: 'me' });
  // OR
  // use the result once the mutation has completed
  mutation({ first: 'Hello!', second: 'me' }).then(result => console.log(result));
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

## Admin HTTP Endpoints

### POST `/admin/seed-clubs`

Seeds the clubs table with hardcoded club data. This endpoint is idempotent and safe to call multiple times.

**Token Protection:**

- Required: Set `ADMIN_SEED_TOKEN` environment variable in your Convex deployment settings
- If `ADMIN_SEED_TOKEN` is configured, the endpoint requires a valid token in either:
  - Header: `x-admin-token: YOUR_TOKEN`
  - Query param: `?token=YOUR_TOKEN`
- If `ADMIN_SEED_TOKEN` is not set, the endpoint returns 403 by default (fail-closed)
- For development without a token, set `ALLOW_OPEN_SEED_ENDPOINT=true` in environment variables

**Usage:**

With token (if configured):

```bash
curl -X POST https://[deployment].convex.cloud/api/admin/seed-clubs \
  -H "x-admin-token: YOUR_TOKEN"
```

Or via query param:

```bash
curl -X POST "https://[deployment].convex.cloud/api/admin/seed-clubs?token=YOUR_TOKEN"
```

Without token (if not configured):

```bash
curl -X POST https://[deployment].convex.cloud/api/admin/seed-clubs
```

**Response:**

```json
{
  "syncedCount": 11
}
```

**Use Cases:**

- Initial deployment: seed 11 clubs once during setup
- Updating clubs: re-run if the `CLUBS` constant in `convex/clubs.ts` is modified

NOTE: The simplest way to run this seed is:

```bash
pnpm exec convex run clubs:syncClubs '{}'
```
