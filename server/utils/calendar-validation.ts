export const calendarTypes = ['personal', 'couple', 'family', 'work', 'custom'] as const
export const memberPermissions = ['owner', 'editor', 'viewer'] as const
export const invitePermissions = ['editor', 'viewer'] as const
export const memberStatuses = ['pending', 'accepted', 'declined'] as const

export type CalendarType = (typeof calendarTypes)[number]
export type MemberPermission = (typeof memberPermissions)[number]
export type InvitePermission = (typeof invitePermissions)[number]
export type MemberStatus = (typeof memberStatuses)[number]

export function parseCalendarPayload(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : '#2563eb'
  const type = typeof body.type === 'string' && calendarTypes.includes(body.type as CalendarType)
    ? body.type as CalendarType
    : 'personal'

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Calendar name is required.'
    })
  }

  return { name, color, type }
}

export function parseInvitePayload(body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const permission = typeof body.permission === 'string' && invitePermissions.includes(body.permission as InvitePermission)
    ? body.permission as InvitePermission
    : 'viewer'

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invite email is required.'
    })
  }

  return { email, permission }
}

export function parseMemberPatchPayload(body: Record<string, unknown>) {
  const permission = typeof body.permission === 'string' && memberPermissions.includes(body.permission as MemberPermission)
    ? body.permission as MemberPermission
    : undefined
  const status = typeof body.status === 'string' && memberStatuses.includes(body.status as MemberStatus)
    ? body.status as MemberStatus
    : undefined

  if (!permission && !status) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid permission or status.'
    })
  }

  return { permission, status }
}
