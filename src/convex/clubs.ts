import { z } from 'zod';

import { sportTypeSchema } from './lib/validation/sharedSchemas';
import { zMutation, zQuery } from './lib/zodHelpers';
import { clubSchema } from './lib/zodSchemas';

// TODO do we have type safety around CLUBS
const CLUBS = [
  {
    slug: 'north-padel-club',
    name: 'North Padel Club',
    address: '115 Rivalda Rd, North York, ON M2M 2S4',
    city: 'Toronto',
    region: 'North York',
    website: 'https://northpadelclub.ca',
    sportsSupported: ['Padel', 'Pickleball'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'blue-cat-padel',
    name: 'Blue Cat Padel',
    address: '1510 Birchmount Road Unit 120, Toronto, ON M1P 2G5',
    city: 'Toronto',
    region: 'North York',
    website: 'https://www.bluecatpadel.com',
    sportsSupported: ['Padel', 'Pickleball'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'the-pad',
    name: 'The Pad',
    address: '309 Cherry St, Toronto, ON M5A 3L3',
    city: 'Toronto',
    region: 'Downtown',
    website: 'https://www.thepad.club',
    sportsSupported: ['Padel'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 't10-padel',
    name: 'T.10 Padel',
    address: '601 Cityview Blvd, Vaughan, ON L4H 0T1',
    city: 'Vaughan',
    region: 'York Region',
    website: 'https://t10padel.com',
    sportsSupported: ['Padel'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'padel-junction',
    name: 'Padel Junction',
    address: '1780 Sismet Rd, Mississauga, ON L4W 1Y8',
    city: 'Mississauga',
    region: 'Peel Region',
    website: 'https://padeljunction.ca',
    sportsSupported: ['Padel'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'kingsway-platform',
    name: 'Kingsway Platform Tennis',
    address: '50 Montgomery Road, Etobicoke, ON M8X 1Z4',
    city: 'Toronto',
    region: 'Etobicoke',
    website: 'http://kingswaypaddle.ca',
    sportsSupported: ['Padel'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'courtx',
    name: 'COURTX',
    address: '226 Wyecroft Rd, Oakville, ON L6K 3X7',
    city: 'Oakville',
    region: 'Halton Region',
    website: 'https://mycourtx.com',
    sportsSupported: ['Padel'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: '6ix-pickle',
    name: '6ix Pickle',
    address: '102 Berkeley St, Toronto, ON M5A 2W7',
    city: 'Toronto',
    region: 'Downtown',
    website: 'https://www.6ixpickle.com',
    sportsSupported: ['Pickleball'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'the-jar',
    name: 'The Jar Pickleball Club',
    address: '900 Caledonia Rd, Toronto, ON M6B 3Y1',
    city: 'Toronto',
    region: 'North York',
    website: 'https://www.thejarpickleball.com',
    sportsSupported: ['Pickleball'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'richmond-green',
    name: 'Richmond Green',
    address: '1300 Elgin Mills Rd E, Richmond Hill, ON L4S 1M5',
    city: 'Richmond Hill',
    region: 'York Region',
    website: 'https://www.richmondhill.ca',
    sportsSupported: ['Pickleball'] as Array<'Padel' | 'Pickleball'>
  },
  {
    slug: 'the-dill',
    name: 'The Dill Pickleball Club',
    address: '32 Colville Rd, North York, ON M6M 2Y4',
    city: 'Toronto',
    region: 'North York',
    website: 'https://book.thedillpickleballclub.com',
    sportsSupported: ['Pickleball'] as Array<'Padel' | 'Pickleball'>
  }
];

export const listClubs = zQuery({
  args: {
    sport: sportTypeSchema.optional()
  },
  returns: z.array(clubSchema),
  handler: async (ctx, args) => {
    const clubs = await ctx.db
      .query('clubs')
      .withIndex('by_name', q => q.gt('name', ''))
      .collect();

    if (!args.sport) {
      return clubs;
    }

    return clubs.filter(club => club.sportsSupported.includes(args.sport!));
  }
});

export const syncClubs = zMutation({
  args: {},
  returns: z.number(),
  handler: async ctx => {
    let syncedCount = 0;

    for (const club of CLUBS) {
      const existing = await ctx.db
        .query('clubs')
        .withIndex('by_slug', q => q.eq('slug', club.slug))
        .unique();

      if (existing) {
        await ctx.db.patch('clubs', existing._id, club);
      } else {
        await ctx.db.insert('clubs', club);
      }

      syncedCount += 1;
    }

    return syncedCount;
  }
});
