# Workout

A workout planner and logger for Android (and iOS), built with Expo / React Native. It follows the
familiar Strong-style flow — templates, a live workout screen with a set grid, rest timer, history
and per-exercise records — with its own code and design. All data is stored locally on the device
in SQLite.

## Features

- **Workout tab** – start an empty workout or start from a template. Templates are split into
  **Workout templates** and **Stretch routines** (two starter stretch routines included); cards show
  their exercises and when they were last performed; duplicate, edit or delete them, group them into
  **folders** (e.g. "PPL", "Mobility") and drag them into any order.
- **Programs** – workouts done in turn, with the next one ready to start on the Workout tab. Add one
  from the library (5×5 Beginner, Upper / Lower, Push / Pull / Legs, Bodyweight Basics) or build your
  own. Exercises carry a **progression rule** that moves their targets on by itself when you finish:
  add weight (or a rep, or 5 s on holds) whenever every set hits its target, with a 10% deload after
  three misses in a row; or work up a rep range (e.g. 8–12) and then add weight. The workout summary
  shows what's set for next time.
- **Live workout** – elapsed timer, editable name and notes, and per exercise a
  `SET | PREVIOUS | KG | REPS | ✓` grid:
  - "Previous" shows what you did last time; tap it to copy those values. Ticking a set with blank
    fields fills them from last time (or the set above).
  - Set types: normal, warm-up (W), drop (D), failure (F) — tap the set number.
  - Auto-generated warm-up sets, per-exercise notes, replace / remove exercises, and drag-to-reorder
    them. Swipe a set left to delete it.
  - **Supersets** – link an exercise with the next one ("Superset with …" in its menu); the rest
    timer only starts after the last exercise of each round.
  - Rest timer starts when you tick a set (±15 s, skip, vibrates when done). Rest time is
    configurable per exercise, per template exercise, or globally.
  - Timed holds (plank, wall sit, stretches…) get a ▶ button: it counts down the set's time
    (or last session's, or 1:00), buzzes, ticks the set off and starts the rest timer
    automatically. ±15 s, Done (records the time held so far) and Cancel while it runs.
  - With the screen off or the app in the background, a notification tells you when a hold or rest
    is over (can be turned off in Settings).
  - The workout survives the app being closed, and keeps the screen on (configurable).
  - Finishing offers to update the template if you changed its exercises or sets, or lifted different
    weights / reps, so next time it starts filled in with what you did.
  - The template and past-workout editors ask before throwing away unsaved changes.
- **Tracking types** – weight & reps, reps only, weighted bodyweight (+kg), assisted bodyweight
  (−kg), duration, distance & duration.
- **History** – workouts grouped by month with "Exercise | Best set" summaries; open one to see
  every set, estimated 1RMs and PRs; edit, repeat, save as template, or delete it. **Share** a
  workout as an image card (name, time, volume, sets, records and each exercise's best set), right
  from the "Nice work!" summary or from its menu.
- **Exercises** – ~900 exercises: a hand-curated core set of ~180 plus the rest of
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db). An anatomical front/back **body map**
  (a little flexing gym goblin by default, or male/female anatomy) lets you tap a muscle to see its exercises. Search, filter by body part and
  equipment, and type (strength, stretching, cardio, plyometrics, Olympic lifting, strongman), sort
  by most used, create custom exercises. Each exercise has **About** (start/end
  photos, muscles, level and step-by-step instructions where available), **History**, **Charts**
  (est. 1RM, heaviest weight, volume, reps, duration, distance) and **Records** (PRs plus a 1–12
  rep-max table). Bodyweight exercises are tracked as reps only; "(Weighted)" and "(Assisted)"
  variants track the added or assisting weight.
- **Suggested workouts** – a recovery map shades the muscles you worked hard in the last few days
  (red) and those still recovering (amber), estimated from your sets; **Suggest a Workout** (Workout
  tab) then builds a session for the freshest split (or the one you pick: push, pull, legs, upper,
  lower, full body) from exercises your gym has, favouring the ones you already do. Shuffle for
  another take, then start it.
- **Gyms** – save the equipment at each place you train (home, work…) and pick where you are:
  exercise lists then show only what you can do there (one tap shows everything again), and
  **Replace exercise** suggests stand-ins that work the same muscles with the kit you have.
  Bodyweight exercises and stretches always count as available.
- **Personal records** – est. 1RM, heaviest weight, best set volume, most reps, longest
  duration/distance, highlighted when a workout beats them.
- **Profile** – workouts total, this week, week streak, workouts-per-week chart, training calendar.
- **Measure** – body weight, body fat and body-part measurements with charts.
- **Tools** – plate calculator (configurable bar and plates), 1RM calculator with percentage table,
  and an **interval timer** (EMOM, Tabata, your own work / rest, AMRAP with a round counter) that
  buzzes at every change, ticks down the last seconds, keeps the screen on and alerts you with it off.
- **Units** – metric or imperial.
- **Import / export** – import your history from a **Strong, Hevy or FitNotes CSV export** (the
  app is detected from the columns; Hevy supersets come along, FitNotes' built-in exercise names are
  mapped onto ours); exercises are matched by name and unknown ones are created. Export
  everything as a Strong-compatible CSV, or back up / restore all data as JSON. **Share** a
  template or a whole program as a file (with its progression rules, without your weights) and
  import ones others send you (Settings, or the program library).

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
npm test            # unit tests: calculations, CSV import/export, workout editing, and the
                    # database (migrations + queries on an in-memory node:sqlite database)
```

### Project layout

```
src/app/            Expo Router screens (files are routes)
  (tabs)/           Profile, History, Workout (start screen), Exercises, Measure
  active-workout    Live workout screen
  workout/[id]      Workout details / summary, workout-edit/[id] to edit
  template/[id]     Template editor ("new" to create)
  program/[id]      Program (its workouts in rotation), programs = the program library
  exercise/[id]     Exercise About / History / Charts / Records
src/components/     Shared UI (WorkoutEditor set grid, charts, sheets, inputs)
src/db/             SQLite schema/migrations (schema.ts), queries (repo.ts), test database (testDb.ts)
src/state/          Settings and active-workout React contexts
src/lib/            Pure logic: calculations, progression rules, formatting, units, CSV import/export
src/data/           Built-in exercise library, starter templates, programs, free-exercise-db copy and links
scripts/            build-free-exercise-db.mjs refreshes src/data/freeExerciseDb.json
```

Weights are stored in kg and distances in metres; they're converted for display. Schema changes go
in a new entry at the end of `MIGRATIONS` in `src/db/schema.ts`.

## Credits

Exercise photos and instructions come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas, released into the public
domain under the Unlicense. The JSON is bundled with the app (refresh it with
`node scripts/build-free-exercise-db.mjs`); photos are loaded from GitHub and cached on the device.

The goblin body map figure is drawn for this app (`src/data/goblinBody.ts`). The male and
female figures come from
[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) (MIT).
