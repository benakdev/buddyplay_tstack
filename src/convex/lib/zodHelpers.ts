import { NoOp } from 'convex-helpers/server/customFunctions';
import { zCustomMutation, zCustomQuery, zid } from 'convex-helpers/server/zod4';

import { internalMutation, internalQuery, mutation, query } from '../_generated/server';

export const zQuery = zCustomQuery(query, NoOp);
export const zMutation = zCustomMutation(mutation, NoOp);
export const zInternalMutation = zCustomMutation(internalMutation, NoOp);
export const zInternalQuery = zCustomQuery(internalQuery, NoOp);

export { zid };
