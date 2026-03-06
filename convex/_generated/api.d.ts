/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as alerts from "../alerts.js";
import type * as clubs from "../clubs.js";
import type * as conversations from "../conversations.js";
import type * as http from "../http.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_validation_sharedSchemas from "../lib/validation/sharedSchemas.js";
import type * as lib_zodHelpers from "../lib/zodHelpers.js";
import type * as lib_zodSchemas from "../lib/zodSchemas.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as requests from "../requests.js";
import type * as sportProfiles from "../sportProfiles.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  alerts: typeof alerts;
  clubs: typeof clubs;
  conversations: typeof conversations;
  http: typeof http;
  "lib/helpers": typeof lib_helpers;
  "lib/notifications": typeof lib_notifications;
  "lib/validation/sharedSchemas": typeof lib_validation_sharedSchemas;
  "lib/zodHelpers": typeof lib_zodHelpers;
  "lib/zodSchemas": typeof lib_zodSchemas;
  messages: typeof messages;
  notifications: typeof notifications;
  requests: typeof requests;
  sportProfiles: typeof sportProfiles;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
