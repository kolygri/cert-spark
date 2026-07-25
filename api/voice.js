const MAX_AUDIO_BYTES = 12 * 1024 * 1024
const audioTypes = new Map([
  ['audio/aac', { type: 'audio/aac', extension: 'aac' }],
  ['audio/flac', { type: 'audio/flac', extension: 'flac' }],
  ['audio/mp4', { type: 'audio/mp4', extension: 'm4a' }],
  ['audio/mpeg', { type: 'audio/mpeg', extension: 'mp3' }],
  ['audio/mp3', { type: 'audio/mpeg', extension: 'mp3' }],
  ['audio/ogg', { type: 'audio/ogg', extension: 'ogg' }],
  ['audio/wav', { type: 'audio/wav', extension: 'wav' }],
  ['audio/wave', { type: 'audio/wav', extension: 'wav' }],
  ['audio/x-wav', { type: 'audio/wav', extension: 'wav' }],
  ['audio/webm', { type: 'audio/webm', extension: 'webm' }],
])

const editableFields = [
  'clientName', 'clientAddress', 'clientPostcode', 'address', 'postcode', 'installationType',
  'description', 'extent', 'departures', 'nextInspection', 'earthingArrangement', 'supplyPhase',
  'nominalVoltage', 'nominalFrequency', 'prospectiveFaultCurrent', 'externalLoopImpedance',
  'mainSwitchType', 'mainSwitchRating', 'earthingConductor', 'bondingConductor', 'maxDemand',
  'distributionBoard', 'boardLocation', 'existingComments', 'circuit1Description', 'circuit1Ocpd',
  'circuit1Rcd', 'circuit1Zs', 'circuit2Description', 'circuit2Ocpd', 'circuit2Rcd', 'circuit2Zs',
]

const editableFieldSet = new Set(editableFields)
const placeholderValuePattern = /^(?:n\/?a|none|unknown|unspecified|not (?:mentioned|provided|specified|stated))$/i

export function normalizeTranscript(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getAudioUploadMetadata(contentType) {
  if (typeof contentType !== 'string') return null
  const normalizedType = contentType.split(';', 1)[0].trim().toLowerCase()
  return audioTypes.get(normalizedType) || null
}

function normalizeEvidence(value) {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeFieldAndValue(field, value, normalizedEvidence) {
  let normalizedField = field
  let normalizedValue = value

  if (
    field === 'clientAddress'
    && /\b(?:installation|property|site)\b.*\bat\b/.test(normalizedEvidence)
    && !/\bclient\b|\bcustomer\b/.test(normalizedEvidence)
  ) {
    normalizedField = 'address'
  }

  if (normalizedField === 'installationType') {
    const installationType = normalizeEvidence(value)
    if (installationType === 'new' || installationType === 'new installation') normalizedValue = 'New installation'
    else if (installationType === 'addition') normalizedValue = 'Addition'
    else if (installationType === 'alteration') normalizedValue = 'Alteration'
    else return null
  }

  if (normalizedField === 'earthingArrangement') {
    const earthingArrangement = normalizeEvidence(value).replaceAll(' ', '')
    if (earthingArrangement === 'tncs' || earthingArrangement === 'tncspme') normalizedValue = 'TN-C-S (PME)'
    else if (earthingArrangement === 'tns') normalizedValue = 'TN-S'
    else if (earthingArrangement === 'tt') normalizedValue = 'TT'
  }

  if (normalizedField === 'postcode' || normalizedField === 'clientPostcode') {
    const compactPostcode = value.toUpperCase().replace(/\s+/g, '')
    if (!/^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compactPostcode)) return null
    normalizedValue = `${compactPostcode.slice(0, -3)} ${compactPostcode.slice(-3)}`
  }

  return { field: normalizedField, value: normalizedValue }
}

export function sanitizeSuggestions(suggestions, transcript) {
  const normalizedTranscript = normalizeEvidence(normalizeTranscript(transcript))
  if (!normalizedTranscript || !Array.isArray(suggestions)) return []

  const suggestionsByField = new Map()

  for (const suggestion of suggestions) {
    if (!suggestion || !editableFieldSet.has(suggestion.field)) continue

    const value = typeof suggestion.value === 'string' ? suggestion.value.trim() : ''
    const evidence = typeof suggestion.evidence === 'string' ? suggestion.evidence.trim() : ''
    const normalizedEvidence = normalizeEvidence(evidence)
    if (
      !value
      || placeholderValuePattern.test(value)
      || !normalizedEvidence
      || !normalizedTranscript.includes(normalizedEvidence)
    ) continue

    const normalized = normalizeFieldAndValue(suggestion.field, value, normalizedEvidence)
    if (!normalized) continue

    const confidence = Number.isFinite(suggestion.confidence)
      ? Math.min(100, Math.max(0, Math.round(suggestion.confidence)))
      : 0
    const sanitized = {
      field: normalized.field,
      label: typeof suggestion.label === 'string' && suggestion.label.trim()
        ? suggestion.label.trim()
        : normalized.field,
      value: normalized.value,
      confidence,
      evidence,
    }
    const existing = suggestionsByField.get(normalized.field)
    if (!existing || sanitized.confidence > existing.confidence) {
      suggestionsByField.set(normalized.field, sanitized)
    }
  }

  return [...suggestionsByField.values()]
}

const responseSchema = {
  name: 'certificate_field_suggestions',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: { type: 'string', enum: editableFields },
            label: { type: 'string' },
            value: { type: 'string' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            evidence: { type: 'string' },
          },
          required: ['field', 'label', 'value', 'confidence', 'evidence'],
        },
      },
    },
    required: ['suggestions'],
  },
}

async function readRequestBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_AUDIO_BYTES) throw new Error('Audio recording is too large. Please keep each note under two minutes.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function openAiJson(url, options) {
  const response = await fetch(url, options)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload?.error?.message || 'OpenAI could not process this recording.')
  return payload
}

async function hasValidSupabaseSession(request) {
  const accessToken = request.headers.authorization
  const projectUrl = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!accessToken?.startsWith('Bearer ') || !projectUrl || !publishableKey) return false

  const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: accessToken },
  })
  return userResponse.ok
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST for voice processing.' })
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: 'Voice processing is not configured yet.' })
  if (!(await hasValidSupabaseSession(request))) return response.status(401).json({ error: 'Sign in before using voice capture.' })

  try {
    const audio = await readRequestBody(request)
    if (!audio.length) return response.status(400).json({ error: 'No audio was received.' })

    const audioMetadata = getAudioUploadMetadata(request.headers['content-type'])
    if (!audioMetadata) {
      return response.status(415).json({ error: 'This browser produced an unsupported audio format. Please try another browser.' })
    }
    const audioForm = new FormData()
    audioForm.append('model', 'gpt-4o-mini-transcribe')
    audioForm.append(
      'file',
      new Blob([audio], { type: audioMetadata.type }),
      `fieldcert-site-note.${audioMetadata.extension}`,
    )

    const transcription = await openAiJson('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: audioForm,
    })
    const transcript = normalizeTranscript(transcription.text)
    if (!transcript) return response.status(200).json({ transcript: '', suggestions: [] })

    const extraction = await openAiJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: responseSchema },
        messages: [
          {
            role: 'system',
            content: 'You map a UK electrician\'s spoken site note to an Electrical Installation Certificate. Return suggestions only for facts explicitly stated in the transcript. Omit every unmentioned field: never return placeholders such as "Not specified", "Unknown", "N/A", or inferred defaults. Never invent a reading, person, address, compliance result, departure, signature, or date. Evidence must be an exact non-empty excerpt from the transcript that supports the value. The field "address" is the electrical installation/site address; "clientAddress" is only the customer\'s separate postal address. Likewise, "postcode" is the site postcode and "clientPostcode" is only the customer\'s postcode. The installationType value must be exactly "New installation", "Addition", or "Alteration". Use the permitted field names. Keep values concise. Use lower confidence for ambiguous speech.',
          },
          { role: 'user', content: transcript },
        ],
      }),
    })

    const mapping = JSON.parse(extraction.choices?.[0]?.message?.content || '{"suggestions":[]}')
    const suggestions = sanitizeSuggestions(mapping.suggestions, transcript)
    return response.status(200).json({ transcript, suggestions })
  } catch (error) {
    console.error('Voice processing failed', {
      contentType: request.headers['content-type'] || null,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return response.status(500).json({ error: error instanceof Error ? error.message : 'Voice processing failed.' })
  }
}
