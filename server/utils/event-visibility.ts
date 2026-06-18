export const relationshipVisibilityModes = ['clear', 'busy', 'hide_category'] as const
export const eventVisibilityValues = ['clear', 'busy', 'hidden'] as const

export type RelationshipVisibilityMode = (typeof relationshipVisibilityModes)[number]
export type ResolvedEventVisibility = (typeof eventVisibilityValues)[number]

export type VisibilityRules = {
  mode: RelationshipVisibilityMode
  hiddenCategory?: string | null
}

export type EventVisibilityInput = {
  id: string
  userId: string
  title: string
  category: string | null
  visibilityDefault: ResolvedEventVisibility
}

export type RelationshipVisibilityInput = {
  userId: string
  targetUserId: string
  visibilityRules: unknown
}

export type EventVisibilityOverrideInput = {
  eventId: string
  targetUserId: string
  visibility: ResolvedEventVisibility
}

export function parseVisibilityRules(value: unknown): VisibilityRules {
  if (!value || typeof value !== 'object') {
    return { mode: 'clear', hiddenCategory: null }
  }

  const rules = value as Record<string, unknown>
  const mode = typeof rules.mode === 'string' && relationshipVisibilityModes.includes(rules.mode as RelationshipVisibilityMode)
    ? rules.mode as RelationshipVisibilityMode
    : 'clear'
  const hiddenCategory = typeof rules.hiddenCategory === 'string' && rules.hiddenCategory.trim()
    ? rules.hiddenCategory.trim()
    : null

  return {
    mode,
    hiddenCategory
  }
}

export function resolveEventVisibility(
  event: EventVisibilityInput,
  viewerUserId: string,
  relationships: RelationshipVisibilityInput[],
  overrides: EventVisibilityOverrideInput[]
) {
  if (event.userId === viewerUserId) {
    return toVisibleEvent(event, 'clear')
  }

  const override = overrides.find((item) =>
    item.eventId === event.id && item.targetUserId === viewerUserId
  )

  if (override) {
    return toVisibleEvent(event, override.visibility)
  }

  const relationship = relationships.find((item) =>
    item.userId === event.userId && item.targetUserId === viewerUserId
  )

  if (relationship) {
    return toVisibleEvent(event, visibilityFromRules(event, parseVisibilityRules(relationship.visibilityRules)))
  }

  return toVisibleEvent(event, event.visibilityDefault)
}

function visibilityFromRules(event: EventVisibilityInput, rules: VisibilityRules): ResolvedEventVisibility {
  if (rules.mode === 'busy') {
    return 'busy'
  }

  if (rules.mode === 'hide_category'
    && rules.hiddenCategory
    && event.category?.toLocaleLowerCase() === rules.hiddenCategory.toLocaleLowerCase()) {
    return 'hidden'
  }

  return 'clear'
}

function toVisibleEvent(event: EventVisibilityInput, visibility: ResolvedEventVisibility) {
  if (visibility === 'hidden') {
    return null
  }

  if (visibility === 'busy') {
    return {
      ...event,
      title: 'Occupato',
      category: null,
      visibilityDefault: 'busy' as const
    }
  }

  return {
    ...event,
    visibilityDefault: 'clear' as const
  }
}
