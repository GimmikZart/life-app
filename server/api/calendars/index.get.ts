import { eq, inArray } from 'drizzle-orm'

import { useDatabase } from '../../database/client'
import { calendarMembers, calendars, users } from '../../database/schema'
import { requireAuthenticatedUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireAuthenticatedUser(event)
  const db = useDatabase()

  const memberships = await db
    .select({
      calendarId: calendarMembers.calendarId,
      permission: calendarMembers.permission,
      status: calendarMembers.status,
      isPrimary: calendarMembers.isPrimary,
      autoIntegrate: calendarMembers.autoIntegrate
    })
    .from(calendarMembers)
    .where(eq(calendarMembers.userId, currentUser.id))

  const calendarIds = memberships.map((membership) => membership.calendarId)

  if (!calendarIds.length) {
    return {
      calendars: [],
      receivedInvites: [],
      sentInvites: []
    }
  }

  const calendarRows = await db
    .select({
      id: calendars.id,
      ownerId: calendars.userId,
      name: calendars.name,
      color: calendars.color,
      type: calendars.type,
      shareToken: calendars.shareToken
    })
    .from(calendars)
    .where(inArray(calendars.id, calendarIds))

  const memberRows = await db
    .select({
      calendarId: calendarMembers.calendarId,
      userId: calendarMembers.userId,
      permission: calendarMembers.permission,
      status: calendarMembers.status,
      email: users.email,
      name: users.name
    })
    .from(calendarMembers)
    .innerJoin(users, eq(users.id, calendarMembers.userId))
    .where(inArray(calendarMembers.calendarId, calendarIds))

  const membershipByCalendar = new Map(
    memberships.map((membership) => [membership.calendarId, membership])
  )

  const calendarsWithMembers = calendarRows.map((calendar) => ({
    ...calendar,
    // Il token di condivisione è visibile solo all'owner (è una "chiave" del calendario).
    shareToken: calendar.ownerId === currentUser.id ? calendar.shareToken : null,
    myPermission: membershipByCalendar.get(calendar.id)?.permission ?? 'viewer',
    myStatus: membershipByCalendar.get(calendar.id)?.status ?? 'pending',
    myIsPrimary: membershipByCalendar.get(calendar.id)?.isPrimary ?? false,
    myAutoIntegrate: membershipByCalendar.get(calendar.id)?.autoIntegrate ?? false,
    members: memberRows.filter((member) => member.calendarId === calendar.id)
  }))

  const receivedInvites = calendarsWithMembers.filter(
    (calendar) => calendar.myStatus === 'pending'
  )

  const sentInvites = memberRows.filter((member) => {
    const calendar = calendarsWithMembers.find((item) => item.id === member.calendarId)

    return calendar?.myPermission === 'owner'
      && member.userId !== currentUser.id
      && member.status === 'pending'
  })

  return {
    calendars: calendarsWithMembers,
    receivedInvites,
    sentInvites
  }
})
