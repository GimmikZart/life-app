<script setup lang="ts">
type SubSkill = { id: string; name: string; weight: number }
type MacroSkill = { id: string; name: string; decayCoefficient: number; subs: SubSkill[] }

const { data, pending, error, refresh } = await useFetch<{ skills: MacroSkill[] }>('/api/skills', {
  default: () => ({ skills: [] })
})

const macros = computed(() => data.value?.skills ?? [])

const newMacroName = ref('')
const newSubName = reactive<Record<string, string>>({})
// Bozza pesi per macro: { [macroId]: { [subId]: weight } }
const weightDrafts = reactive<Record<string, Record<string, number>>>({})

const actionMessage = ref('')
const errorMessage = ref('')

function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    const fetchError = err as Error & { data?: { statusMessage?: string } }

    return fetchError.data?.statusMessage ?? err.message
  }

  return 'Operazione non riuscita.'
}

async function withFeedback(run: () => Promise<void>, success: string) {
  actionMessage.value = ''
  errorMessage.value = ''

  try {
    await run()
    actionMessage.value = success
    await refresh()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

async function createMacro() {
  if (!newMacroName.value.trim()) {
    return
  }

  const name = newMacroName.value
  await withFeedback(async () => {
    await $fetch('/api/skills', { method: 'POST', body: { name } })
    newMacroName.value = ''
  }, 'Macro-skill creata.')
}

async function createSub(macroId: string) {
  const name = (newSubName[macroId] ?? '').trim()

  if (!name) {
    return
  }

  await withFeedback(async () => {
    await $fetch('/api/skills', { method: 'POST', body: { name, parentSkillId: macroId } })
    newSubName[macroId] = ''
  }, 'Sub-skill aggiunta.')
}

async function removeSkill(skillId: string, label: string) {
  if (import.meta.client && !window.confirm(`Eliminare "${label}"?`)) {
    return
  }

  await withFeedback(async () => {
    await $fetch(`/api/skills/${skillId}` as string, { method: 'DELETE' })
  }, 'Skill eliminata.')
}

function draftFor(macro: MacroSkill) {
  if (!weightDrafts[macro.id]) {
    weightDrafts[macro.id] = Object.fromEntries(macro.subs.map((sub) => [sub.id, sub.weight]))
  }

  return weightDrafts[macro.id]!
}

function draftSum(macro: MacroSkill) {
  const draft = draftFor(macro)

  return macro.subs.reduce((total, sub) => total + (Number(draft[sub.id]) || 0), 0)
}

async function saveWeights(macro: MacroSkill) {
  const draft = draftFor(macro)
  const weights = macro.subs.map((sub) => ({ childSkillId: sub.id, weight: Number(draft[sub.id]) || 0 }))

  await withFeedback(async () => {
    await $fetch(`/api/skills/${macro.id}/weights` as string, { method: 'PATCH', body: { weights } })
    delete weightDrafts[macro.id]
  }, 'Pesi aggiornati.')
}

// Reset della bozza pesi quando i dati si aggiornano (es. dopo aggiunta sub).
watch(macros, () => {
  for (const key of Object.keys(weightDrafts)) {
    delete weightDrafts[key]
  }
})
</script>

<template>
  <section class="skills-tool">
    <div class="skills-tool__header">
      <NuxtLink class="back-link" to="/">Torna alla Today</NuxtLink>
      <p class="skills-tool__eyebrow">Skill</p>
      <h1>Le mie Skill</h1>
      <p class="skills-tool__lead">
        Organizza le competenze in macro-skill e sub-skill con pesi. Collega gli
        eventi alle skill: svolgendoli le farai crescere.
      </p>
    </div>

    <p v-if="actionMessage" class="feedback feedback--success" role="status">{{ actionMessage }}</p>
    <p v-if="errorMessage" class="feedback feedback--error" role="alert">{{ errorMessage }}</p>

    <form class="macro-form" @submit.prevent="createMacro">
      <label>
        Nuova macro-skill
        <input v-model="newMacroName" type="text" placeholder="Es. Danza" required>
      </label>
      <button class="button button--primary" type="submit">Crea macro-skill</button>
    </form>

    <div class="skills-list">
      <p v-if="pending" class="empty-state">Carico le skill...</p>
      <p v-else-if="error" class="empty-state empty-state--error">Non riesco a caricare le skill.</p>
      <p v-else-if="!macros.length" class="empty-state">Nessuna skill ancora. Crea una macro-skill qui sopra.</p>

      <article v-for="macro in macros" :key="macro.id" class="macro-card">
        <header class="macro-card__head">
          <strong>{{ macro.name }}</strong>
          <button class="button button--danger button--sm" type="button" @click="removeSkill(macro.id, macro.name)">Elimina</button>
        </header>

        <div v-if="macro.subs.length" class="subs">
          <div v-for="sub in macro.subs" :key="sub.id" class="sub-row">
            <span class="sub-row__name">{{ sub.name }}</span>
            <input
              v-model.number="draftFor(macro)[sub.id]"
              class="sub-row__weight"
              type="number"
              min="0"
              max="100"
              aria-label="Peso"
            >
            <span class="sub-row__pct">%</span>
            <button class="button button--ghost button--sm" type="button" @click="removeSkill(sub.id, sub.name)">✕</button>
          </div>

          <div class="subs__footer">
            <span :class="['subs__sum', draftSum(macro) === 100 ? 'subs__sum--ok' : 'subs__sum--warn']">
              Somma: {{ draftSum(macro) }}%
            </span>
            <button
              class="button button--secondary button--sm"
              type="button"
              :disabled="draftSum(macro) !== 100"
              @click="saveWeights(macro)"
            >
              Salva pesi
            </button>
          </div>
        </div>
        <p v-else class="macro-card__empty">Nessuna sub-skill.</p>

        <form class="sub-form" @submit.prevent="createSub(macro.id)">
          <input v-model="newSubName[macro.id]" type="text" placeholder="Aggiungi sub-skill (es. Popping)">
          <button class="button button--ghost button--sm" type="submit">+ Aggiungi</button>
        </form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.skills-tool {
  width: min(100% - (var(--shell-inline-padding) * 2), 860px);
  margin: 0 auto;
  padding: 18px 0 32px;
}

.skills-tool__header {
  margin-bottom: 18px;
}

.skills-tool__eyebrow {
  margin: 16px 0 8px;
  color: var(--color-accent);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.skills-tool__lead {
  color: var(--color-muted);
  line-height: 1.6;
}

h1,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: 2.2rem;
  line-height: 1.05;
}

.back-link {
  color: var(--color-muted);
  font-weight: 800;
  text-decoration: none;
}

.macro-form,
.macro-card {
  margin-bottom: 14px;
  padding: 18px;
  border: 1px solid rgba(229, 231, 235, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
}

.macro-form {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 7px;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 800;
}

input {
  min-height: 48px;
  width: 100%;
  padding: 0 13px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink);
  font: inherit;
}

.macro-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.macro-card__head strong {
  font-size: 1.15rem;
}

.macro-card__empty {
  color: var(--color-muted);
}

.subs {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.sub-row {
  display: grid;
  grid-template-columns: 1fr 80px auto auto;
  align-items: center;
  gap: 8px;
}

.sub-row__name {
  overflow-wrap: anywhere;
  font-weight: 700;
}

.sub-row__weight {
  min-height: 40px;
  text-align: right;
}

.sub-row__pct {
  color: var(--color-muted);
  font-weight: 800;
}

.subs__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 6px;
}

.subs__sum {
  font-weight: 900;
}

.subs__sum--ok {
  color: #166534;
}

.subs__sum--warn {
  color: #b45309;
}

.sub-form {
  display: flex;
  gap: 8px;
}

.sub-form input {
  flex: 1;
  min-height: 44px;
}

.button {
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-weight: 900;
  white-space: nowrap;
}

.button--sm {
  min-height: 38px;
  padding: 0 12px;
  font-size: 0.85rem;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.button--primary {
  background: var(--color-ink);
  color: #ffffff;
}

.button--secondary {
  background: #e0ecff;
  color: #174ea6;
}

.button--ghost {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: var(--color-ink);
}

.button--danger {
  border: 1px solid #fecaca;
  background: #fff5f5;
  color: #b91c1c;
}

.skills-list {
  display: grid;
}

.empty-state {
  margin: 0;
  padding: 22px 16px;
  border: 1px dashed rgba(148, 163, 184, 0.6);
  border-radius: 8px;
  color: var(--color-muted);
  text-align: center;
}

.empty-state--error {
  border-color: #fecaca;
  color: #b91c1c;
}

.feedback {
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 8px;
  font-weight: 800;
}

.feedback--success {
  background: #dcfce7;
  color: #166534;
}

.feedback--error {
  background: #fee2e2;
  color: #b91c1c;
}

@media (min-width: 760px) {
  .skills-tool {
    padding: 34px 0 44px;
  }
}
</style>
