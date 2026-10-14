# Workout

A workout planner and logger for Android (and iOS), built with Expo / React Native. It follows the
familiar Strong-style flow — templates, a live workout screen with a set grid, rest timer, history
and per-exercise records — with its own code and design. All data is stored locally on the device
in SQLite.

## Features

- **Workout tab** – start an empty workout or start from a template. Templates show their exercises
  and when they were last performed; duplicate, edit or delete them.
- **Live workout** – elapsed timer, editable name and notes, and per exercise a
  `SET | PREVIOUS | KG | REPS | ✓` grid:
  - "Previous" shows what you did last time; tap it to copy those values. Ticking a set with blank
    fields fills them from last time (or the set above).
  - Set types: normal, warm-up (W), drop (D), failure (F) — tap the set number.
  - Auto-generated warm-up sets, per-exercise notes, replace / reorder / remove exercises.
  - Rest timer starts when you tick a set (±15 s, skip, vibrates when done). Rest time is
    configurable per exercise, per template exercise, or globally.
  - Timed holds (plank, wall sit, stretches…) get a ▶ button: it counts down the set's time
    (or last session's, or 1:00), buzzes, ticks the set off and starts the rest timer
    automatically. ±15 s, Done (records the time held so far) and Cancel while it runs.
  - The workout survives the app being closed, and keeps the screen on (configurable).
  - Finishing offers to update the template if you changed exercises or set counts.
- **Tracking types** – weight & reps, reps only, weighted bodyweight (+kg), assisted bodyweight
  (−kg), duration, distance & duration.
- **History** – workouts grouped by month with "Exercise | Best set" summaries; open one to see
  every set, estimated 1RMs and PRs; edit, repeat, save as template, or delete it.
- **Exercises** – ~900 exercises: a hand-curated core set of ~180 plus the rest of
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db). Search, filter by body part and
  equipment, sort by most used, create custom exercises. Each exercise has **About** (start/end
  photos, muscles, level and step-by-step instructions where available), **History**, **Charts**
  (est. 1RM, heaviest weight, volume, reps, duration, distance) and **Records** (PRs plus a 1–12
  rep-max table). Bodyweight exercises are tracked as reps only; "(Weighted)" and "(Assisted)"
  variants track the added or assisting weight.
- **Personal records** – est. 1RM, heaviest weight, best set volume, most reps, longest
  duration/distance, highlighted when a workout beats them.
- **Profile** – workouts total, this week, week streak, workouts-per-week chart, training calendar.
- **Measure** – body weight, body fat and body-part measurements with charts.
- **Tools** – plate calculator (configurable bar and plates) and 1RM calculator with percentage table.
- **Units** – metric or imperial.
- **Import / export** – import your history from a **Strong CSV export** (Strong → Settings →
  Export Strong Data); exercises are matched by name and unknown ones are created. Export
  everything as a Strong-compatible CSV, or back up / restore all data as JSON.

## Running it

Requirements: Node 20+ and the [Expo Go](https://expo.dev/go) app on an Android phone (SDK 57).

```bash
npm install
npm start          # scan the QR code with Expo Go
npm run android    # or open in an Android emulator
```

## Building an APK

Builds run in the cloud with EAS — no Android Studio needed:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # installable .apk
npx eas-cli@latest build -p android --profile production # .aab for the Play Store
```

## Development

```bash
npm run typecheck   # tsc
npm run lint        # expo lint
npm test            # unit tests for calculations, CSV import/export and workout editing
```

### Project layout

```
src/app/            Expo Router screens (files are routes)
  (tabs)/           Profile, History, Workout (start screen), Exercises, Measure
  active-workout    Live workout screen
  workout/[id]      Workout details / summary, workout-edit/[id] to edit
  template/[id]     Template editor ("new" to create)
  exercise/[id]     Exercise About / History / Charts / Records
src/components/     Shared UI (WorkoutEditor set grid, charts, sheets, inputs)
src/db/             SQLite schema/migrations (schema.ts) and queries (repo.ts)
src/state/          Settings and active-workout React contexts
src/lib/            Pure logic: calculations, formatting, units, CSV import/export
src/data/           Built-in exercise library, starter templates, free-exercise-db copy and links
scripts/            build-free-exercise-db.mjs refreshes src/data/freeExerciseDb.json
```

Weights are stored in kg and distances in metres; they're converted for display. Schema changes go
in a new entry at the end of `MIGRATIONS` in `src/db/schema.ts`.

## Credits

Exercise photos and instructions come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released into the public
domain under the Unlicense. The JSON is bundled with the app (refresh it with
`node scripts/build-free-exercise-db.mjs`); photos are loaded from GitHub and cached on the device.
