import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';

import {
  activityParticipantTableSchema,
  activityTableSchema,
  alertTableSchema,
  clubTableSchema,
  conversationParticipantTableSchema,
  conversationTableSchema,
  messageTableSchema,
  notificationTableSchema,
  requestTableSchema,
  sportProfileTableSchema,
  userTableSchema
} from './lib/zodSchemas';

// ============================================
// BUDDYPLAY - PRODUCTION-READY SCHEMA
// "The perfect match for every court."
// ============================================

export default defineSchema({
  // ============================================
  // 1. USERS
  // ============================================
  users: defineTable(zodOutputToConvex(userTableSchema))
    .index('by_token', ['tokenIdentifier'])
    .index('by_username', ['username']),

  // ============================================
  // 2. CLUBS
  // ============================================
  clubs: defineTable(zodOutputToConvex(clubTableSchema))
    .index('by_city', ['city'])
    .index('by_name', ['name'])
    .index('by_slug', ['slug']),

  // ============================================
  // 3. USER SPORT PROFILES
  // "Find players like you"
  // ============================================
  userSportProfiles: defineTable(zodOutputToConvex(sportProfileTableSchema))
    .index('by_user_id', ['userId'])
    .index('by_sport_active_level', ['sport', 'isActive', 'skillLevel'])
    .index('by_user_sport', ['userId', 'sport']),

  // ============================================
  // 4. ACTIVITIES (Games)
  // "Find games you can join"
  // ============================================
  activities: defineTable(zodOutputToConvex(activityTableSchema))
    .index('by_sport_city_status', ['sport', 'location.city', 'status'])
    .index('by_sport_city_time', ['sport', 'location.city', 'startTime'])
    .index('by_sport_club_status', ['sport', 'location.clubId', 'status'])
    .index('by_sport_club_status_startTime', ['sport', 'location.clubId', 'status', 'startTime'])
    .index('by_sport_status', ['sport', 'status'])
    .index('by_sport_status_startTime', ['sport', 'status', 'startTime'])
    .index('by_creator', ['creatorId'])
    .index('by_creator_status', ['creatorId', 'status'])
    .index('by_status', ['status'])
    .index('by_status_startTime', ['status', 'startTime']),

  // ============================================
  // 5. ACTIVITY PARTICIPANTS
  // Tracks who is in which game
  // ============================================
  activityParticipants: defineTable(zodOutputToConvex(activityParticipantTableSchema))
    .index('by_activity', ['activityId'])
    .index('by_user', ['userId'])
    .index('by_activity_user', ['activityId', 'userId']),

  // ============================================
  // 6. ALERTS
  // "Notify me when a matching game is posted"
  // ============================================
  alerts: defineTable(zodOutputToConvex(alertTableSchema))
    .index('by_user', ['userId'])
    .index('by_sport_city_active', ['sport', 'filters.city', 'active'])
    .index('by_sport_club_active', ['sport', 'filters.clubId', 'active']),

  // ============================================
  // 7. REQUESTS (Join Game Flow)
  // ============================================
  requests: defineTable(zodOutputToConvex(requestTableSchema))
    .index('by_activity', ['activityId'])
    .index('by_user_status', ['userId', 'status'])
    .index('by_host_status', ['hostId', 'status'])
    .index('by_activity_user', ['activityId', 'userId']),

  // ============================================
  // 8. NOTIFICATIONS (User Inbox)
  // ============================================
  notifications: defineTable(zodOutputToConvex(notificationTableSchema))
    .index('by_user_read', ['userId', 'read'])
    .index('by_user', ['userId'])
    .index('by_profile', ['profileId'])
    .index('by_matching_profile', ['matchingProfileId']),

  // ============================================
  // 9. CONVERSATIONS
  // ============================================
  conversations: defineTable(zodOutputToConvex(conversationTableSchema))
    .index('by_activity', ['activityId'])
    .index('by_last_message', ['lastMessageAt'])
    .index('by_type', ['type']),

  // ============================================
  // 10. CONVERSATION PARTICIPANTS
  // ============================================
  conversationParticipants: defineTable(zodOutputToConvex(conversationParticipantTableSchema))
    .index('by_conversation_id', ['conversationId'])
    .index('by_user_id', ['userId'])
    .index('by_conversation_id_and_user_id', ['conversationId', 'userId']),

  // ============================================
  // 11. MESSAGES
  // ============================================
  messages: defineTable(zodOutputToConvex(messageTableSchema)).index('by_conversation_id', ['conversationId'])
});
