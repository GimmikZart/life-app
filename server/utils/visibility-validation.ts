import {
  eventVisibilityValues,
  parseVisibilityRules,
  relationshipVisibilityModes,
  type RelationshipVisibilityMode,
  type ResolvedEventVisibility
} from './event-visibility'

export function parseRelationshipPayload(body: Record<string, unknown>) {
  const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLocaleLowerCase() : ''
  const relationshipType = typeof body.relationshipType === 'string' ? body.relationshipType.trim() : ''
  const visibilityRules = parseVisibilityRules(body.visibilityRules)

  if (!targetEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Target email is required.' })
  }

  if (!relationshipType) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship type is required.' })
  }

  validateVisibilityRules(visibilityRules)

  return {
    targetEmail,
    relationshipType,
    visibilityRules
  }
}

export function parseRelationshipPatchPayload(body: Record<string, unknown>) {
  const relationshipType = typeof body.relationshipType === 'string' ? body.relationshipType.trim() : null
  const visibilityRules = body.visibilityRules === undefined ? null : parseVisibilityRules(body.visibilityRules)

  if (relationshipType !== null && !relationshipType) {
    throw createError({ statusCode: 400, statusMessage: 'Relationship type cannot be empty.' })
  }

  if (visibilityRules) {
    validateVisibilityRules(visibilityRules)
  }

  if (relationshipType === null && visibilityRules === null) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update.' })
  }

  return {
    relationshipType,
    visibilityRules
  }
}

export function parseVisibilityOverridePayload(body: Record<string, unknown>) {
  const eventId = typeof body.eventId === 'string' ? body.eventId : ''
  const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLocaleLowerCase() : ''
  const visibility = typeof body.visibility === 'string' && eventVisibilityValues.includes(body.visibility as ResolvedEventVisibility)
    ? body.visibility as ResolvedEventVisibility
    : null

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Event id is required.' })
  }

  if (!targetEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Target email is required.' })
  }

  if (!visibility) {
    throw createError({ statusCode: 400, statusMessage: 'Valid visibility is required.' })
  }

  return {
    eventId,
    targetEmail,
    visibility
  }
}

export function parseVisibilityOverridePatchPayload(body: Record<string, unknown>) {
  const visibility = typeof body.visibility === 'string' && eventVisibilityValues.includes(body.visibility as ResolvedEventVisibility)
    ? body.visibility as ResolvedEventVisibility
    : null

  if (!visibility) {
    throw createError({ statusCode: 400, statusMessage: 'Valid visibility is required.' })
  }

  return { visibility }
}

function validateVisibilityRules(rules: { mode: RelationshipVisibilityMode; hiddenCategory?: string | null }) {
  if (!relationshipVisibilityModes.includes(rules.mode)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid visibility rule mode is required.' })
  }

  if (rules.mode === 'hide_category' && !rules.hiddenCategory) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Category is required when hiding a category.'
    })
  }
}
