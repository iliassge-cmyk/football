import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isAdmin } from '../lib/adminAuth'
import { parseCsv, toCsv, downloadTextFile } from '../lib/csv'

// --- Daily Top 10 -----------------------------------------------------

const TOP10_COLUMNS = ['date', 'title', 'rank', 'name', 'value', 'source_primary', 'source_secondary', 'verified_date']

function top10Template() {
  const rows = []
  for (let rank = 1; rank <= 10; rank++) {
    rows.push({
      date: '2026-10-01',
      title: 'Example: Bundesliga all-time top 10 assist providers',
      rank,
      name: rank === 1 ? 'Example Player' : '',
      value: rank === 1 ? '123 assists' : '',
      source_primary: rank === 1 ? 'https://example.com/source' : '',
      source_secondary: '',
      verified_date: rank === 1 ? '2026-10-01' : '',
    })
  }
  return toCsv(TOP10_COLUMNS, rows)
}

// Groups the 10-rows-per-challenge CSV shape back into daily_top10.json's
// {date, title, entries: [...], source_primary, source_secondary, verified_date}
// shape, and checks everything the DB schema (and the game itself) requires.
function validateTop10Rows(rows) {
  const byDate = new Map()
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r])

  const challenges = []
  const errors = []

  for (const [date, group] of byDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`"${date}": not a YYYY-MM-DD date`)
    if (group.length !== 10) {
      errors.push(`"${date}" (${group[0]?.title}): ${group.length} rows, needs exactly 10`)
      continue
    }
    const ranks = group.map((r) => Number(r.rank)).sort((a, b) => a - b)
    if (JSON.stringify(ranks) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) {
      errors.push(`"${date}" (${group[0]?.title}): rank column must be exactly 1-10, got ${ranks.join(',')}`)
      continue
    }
    const missingName = group.find((r) => !r.name.trim())
    if (missingName) errors.push(`"${date}": rank ${missingName.rank} has no name`)
    const title = group[0].title
    const inconsistentTitle = group.find((r) => r.title !== title)
    if (inconsistentTitle) errors.push(`"${date}": title differs between rows - use the same title for all 10 rows`)

    challenges.push({
      date,
      title,
      entries: group
        .sort((a, b) => Number(a.rank) - Number(b.rank))
        .map((r) => ({ rank: Number(r.rank), name: r.name.trim(), value: r.value.trim() })),
      source_primary: group[0].source_primary || null,
      source_secondary: group[0].source_secondary || null,
      verified_date: group[0].verified_date || null,
    })
  }

  return { challenges: challenges.sort((a, b) => a.date.localeCompare(b.date)), errors }
}

// --- Minefield ----------------------------------------------------------

const MINEFIELD_COLUMNS = [
  'category_id',
  'title',
  'criteria_description',
  'name',
  'meets_criteria',
  'actual_value',
  'source',
  'verified_date',
]

function minefieldTemplate() {
  const rows = []
  for (let i = 0; i < 16; i++) {
    rows.push({
      category_id: 'example-category',
      title: 'Example: Players with 90+ Bundesliga assists',
      criteria_description: 'Career Bundesliga assists >= 90',
      name: i === 0 ? 'Example Player' : '',
      meets_criteria: i === 0 ? 'true' : i < 10 ? 'true' : 'false', // 10 true, 6 false total
      actual_value: i === 0 ? '112 assists' : '',
      source: i === 0 ? 'https://example.com/source' : '',
      verified_date: i === 0 ? '2026-10-01' : '',
    })
  }
  return toCsv(MINEFIELD_COLUMNS, rows)
}

// Minefield's true/false split isn't just convention: Minefield.jsx hard-codes
// "win at 10 safe tiles found" / "lose at 6 bombs hit", so a category with any
// other split is either unwinnable or never shows all its bombs.
function validateMinefieldRows(rows) {
  const byCategory = new Map()
  for (const r of rows) byCategory.set(r.category_id, [...(byCategory.get(r.category_id) ?? []), r])

  const categories = []
  const errors = []

  for (const [id, group] of byCategory) {
    if (group.length !== 16) {
      errors.push(`"${id}": ${group.length} rows, needs exactly 16`)
      continue
    }
    const trueCount = group.filter((r) => r.meets_criteria.toLowerCase() === 'true').length
    const falseCount = group.filter((r) => r.meets_criteria.toLowerCase() === 'false').length
    if (trueCount !== 10 || falseCount !== 6) {
      errors.push(`"${id}": needs exactly 10 "true" + 6 "false" in meets_criteria, got ${trueCount} true / ${falseCount} false`)
      continue
    }
    const missingName = group.find((r) => !r.name.trim())
    if (missingName) errors.push(`"${id}": a tile is missing a name`)
    const title = group[0].title

    categories.push({
      id,
      title,
      criteria_description: group[0].criteria_description || null,
      tiles: group.map((r) => ({
        name: r.name.trim(),
        meets_criteria: r.meets_criteria.toLowerCase() === 'true',
        actual_value: r.actual_value.trim(),
      })),
      source: group[0].source || null,
      verified_date: group[0].verified_date || null,
    })
  }

  return { categories, errors }
}

// --- Shared upload UI -----------------------------------------------------

function UploadSection({ title, description, columns, templateFn, templateFilename, validateFn, jsonFilename }) {
  const [result, setResult] = useState(null) // { items, errors, itemCount }
  const [fileName, setFileName] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const rows = parseCsv(text)
    const missingCols = columns.filter((c) => !(c in (rows[0] ?? {})))
    if (missingCols.length > 0) {
      setResult({ items: [], errors: [`Missing column(s): ${missingCols.join(', ')}`], itemCount: 0 })
      return
    }
    const { errors, ...rest } = validateFn(rows)
    const items = rest.challenges ?? rest.categories
    setResult({ items, errors, itemCount: items.length })
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result.items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = jsonFilename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-display text-xl font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/60">{description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => downloadTextFile(templateFilename, templateFn())}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          Download CSV template
        </button>
        <label className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400">
          Upload filled-in CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>
        {fileName && <span className="text-sm text-white/50">{fileName}</span>}
      </div>

      {result && (
        <div className="mt-4">
          {result.errors.length > 0 ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-sm font-semibold text-red-300">{result.errors.length} problem(s) found - nothing generated yet:</p>
              <ul className="mt-1 list-inside list-disc text-sm text-red-200/90">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3">
              <p className="text-sm font-semibold text-green-300">
                {result.itemCount} valid entr{result.itemCount === 1 ? 'y' : 'ies'} ready.
              </p>
              <button
                type="button"
                onClick={downloadJson}
                className="mt-2 rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-green-400"
              >
                Download JSON
              </button>
              <p className="mt-2 text-xs text-white/50">
                Paste the downloaded array's entries into the matching file in <code>src/data/</code>, commit, and
                push — the sync workflow takes it from there.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const { user, loading } = useAuth()

  if (loading) return <p className="text-white/50 text-center py-12">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin(user)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Not authorized</h1>
        <p className="mt-2 text-white/60">This page is restricted to the site operator.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Content Admin</h1>
        <p className="mt-1 text-white/60">
          Download a CSV template, fill it in (Excel, Google Sheets, Numbers all work), upload it here to validate,
          then download the resulting JSON to paste into <code>src/data/</code>. This never writes to the database
          directly — <code>daily_challenges</code>/<code>minefield_challenges</code> deliberately have no
          client-facing insert policy (future days must never be readable before their date), so publishing still
          goes through a commit + the automated sync workflow.
        </p>
      </div>

      <UploadSection
        title="Daily Top 10"
        description="10 rows per challenge (one per rank), grouped by date. See the template for the exact shape."
        columns={TOP10_COLUMNS}
        templateFn={top10Template}
        templateFilename="daily_top10_template.csv"
        validateFn={validateTop10Rows}
        jsonFilename="daily_top10_new_entries.json"
      />

      <UploadSection
        title="Minefield"
        description='16 rows per category (one per tile), grouped by category_id. Exactly 10 "true" + 6 "false" required in meets_criteria.'
        columns={MINEFIELD_COLUMNS}
        templateFn={minefieldTemplate}
        templateFilename="minefield_template.csv"
        validateFn={validateMinefieldRows}
        jsonFilename="minefield_new_categories.json"
      />
    </div>
  )
}
