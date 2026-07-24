import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTranscript, sanitizeSuggestions } from './voice.js'

test('normalizes missing and whitespace-only transcripts', () => {
  assert.equal(normalizeTranscript(undefined), '')
  assert.equal(normalizeTranscript('   '), '')
  assert.equal(normalizeTranscript('  Supply is TN-C-S.  '), 'Supply is TN-C-S.')
})

test('returns no suggestions for an empty transcript', () => {
  assert.deepEqual(sanitizeSuggestions([
    {
      field: 'address',
      label: 'Installation Address',
      value: 'Not specified',
      confidence: 50,
      evidence: '',
    },
  ], ''), [])
})

test('removes placeholders, unsupported fields, and unsupported evidence', () => {
  const transcript = 'The installation address is 24 Willow Lane.'
  const suggestions = sanitizeSuggestions([
    {
      field: 'address',
      label: 'Installation Address',
      value: '24 Willow Lane',
      confidence: 97,
      evidence: '24 Willow Lane',
    },
    {
      field: 'postcode',
      label: 'Postcode',
      value: 'Not specified',
      confidence: 10,
      evidence: 'The installation address',
    },
    {
      field: 'certificateNo',
      label: 'Certificate number',
      value: 'EIC-99',
      confidence: 100,
      evidence: '24 Willow Lane',
    },
    {
      field: 'description',
      label: 'Description',
      value: 'Full rewire',
      confidence: 80,
      evidence: 'full rewire',
    },
  ], transcript)

  assert.deepEqual(suggestions, [{
    field: 'address',
    label: 'Installation Address',
    value: '24 Willow Lane',
    confidence: 97,
    evidence: '24 Willow Lane',
  }])
})

test('deduplicates fields and keeps the highest-confidence supported suggestion', () => {
  const transcript = 'The supply is TN-C-S, also known as PME.'
  const suggestions = sanitizeSuggestions([
    {
      field: 'earthingArrangement',
      label: 'Earthing arrangement',
      value: 'TN-C-S',
      confidence: 82.4,
      evidence: 'TN-C-S',
    },
    {
      field: 'earthingArrangement',
      label: 'Earthing arrangement',
      value: 'TN-C-S (PME)',
      confidence: 96.7,
      evidence: 'TN-C-S, also known as PME',
    },
  ], transcript)

  assert.deepEqual(suggestions, [{
    field: 'earthingArrangement',
    label: 'Earthing arrangement',
    value: 'TN-C-S (PME)',
    confidence: 97,
    evidence: 'TN-C-S, also known as PME',
  }])
})

test('disambiguates a site address and canonicalizes supported certificate values', () => {
  const transcript = 'This is a new installation at 24 Willow Lane. The earthing arrangement is TNCS.'
  const suggestions = sanitizeSuggestions([
    {
      field: 'clientAddress',
      label: 'Client Address',
      value: '24 Willow Lane',
      confidence: 98,
      evidence: 'This is a new installation at 24 Willow Lane.',
    },
    {
      field: 'installationType',
      label: 'Installation Type',
      value: 'new',
      confidence: 99,
      evidence: 'new installation',
    },
    {
      field: 'earthingArrangement',
      label: 'Earthing Arrangement',
      value: 'TNCS',
      confidence: 97,
      evidence: 'The earthing arrangement is TNCS.',
    },
  ], transcript)

  assert.deepEqual(suggestions.map(({ field, value }) => ({ field, value })), [
    { field: 'address', value: '24 Willow Lane' },
    { field: 'installationType', value: 'New installation' },
    { field: 'earthingArrangement', value: 'TN-C-S (PME)' },
  ])
})

test('formats valid UK postcodes and rejects malformed ones', () => {
  const transcript = 'The site postcode is B14 7QY, not B147Q.'
  const suggestions = sanitizeSuggestions([
    {
      field: 'postcode',
      label: 'Postcode',
      value: 'b147qy',
      confidence: 99,
      evidence: 'B14 7QY',
    },
    {
      field: 'clientPostcode',
      label: 'Client Postcode',
      value: 'B147Q',
      confidence: 99,
      evidence: 'B147Q',
    },
  ], transcript)

  assert.deepEqual(suggestions.map(({ field, value }) => ({ field, value })), [
    { field: 'postcode', value: 'B14 7QY' },
  ])
})
