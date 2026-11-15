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
- **Live workout** – elapsed timer, editable name and notes, and per exercise a
  `SET | PREVIOUS | KG | REPS | ✓` grid:
  - "Previous" shows what you did last time; tap it to copy those values. Ticking a set with blank
    fields fills them from last time (or the set above).
  - Set types: normal, warm-up (W), drop (D), failure (F) — tap the set number.
  - Auto-generated warm-up sets, per-exercise notes, replace / remove exercises, and drag-to-reorder
    them. Swipe a set left to delete it.
  - **Supersets** – link an exercise with the next one ("Superset with …" in its menu); the rest
    timer only starts after the last exercise of each round.
  - Rest timer starts when you tick a set (±15 s, skip). It ticks on the last three seconds and
    dings and vibrates when done; the ding also plays with the screen off (can be turned off in
    Settings). Rest time is
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
  every set, estimated 1RMs and PRs; edit, repeat, save as template, or delete it.
- **Exercises** – ~900 exercises: a hand-curated core set of ~180 plus the rest of
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db). An anatomical front/back **body map**
  (a little flexing gym goblin by default, or male/female anatomy) lets you tap a muscle to see its exercises. Search, filter by body part and
  equipment, and type (strength, stretching, cardio, plyometrics, Olympic lifting, strongman), sort
  by most used, create custom exercises. Each exercise has **About** (start/end
  photos, muscles, level and step-by-step instructions where available), **History**, **Charts**
  (est. 1RM, heaviest weight, volume, reps, duration, distance) and **Records** (PRs plus a 1–12
  rep-max table). Bodyweight exercises are tracked as reps only; "(Weighted)" and "(Assisted)"
  variants track the added or assisting weight.
- **Personal records** – est. 1RM, heaviest weight, best set volume, most reps, longest
  duration/distance, highlighted when a workout beats them.
- **Hero** – the app treats your training like levelling a game character:
  - **XP and levels** – every finished set earns XP (10 per set, 3 for warm-ups; holds and
    stretches by time, cardio by the minute), plus 50 for finishing the workout, 25 for each
    exercise where you beat a personal record, and up to +25 % for training week after week. Level 2
    takes 100 XP and each level takes 100 more than the last, up to level 99.
  - **Ranks and class** – E (Rookie) through SSS (Mythic) as you level; your class (Vanguard,
    Ranger, Juggernaut, Guardian, Pathfinder, Monk or Paragon) follows the stat you train most.
  - **Six stats** – Might (chest, shoulders, triceps), Grip (back, biceps, forearms), Drive (legs),
    Fortitude (core, neck), Stamina (cardio, plyometrics) and Agility (stretching) level up from the
    exercises behind them, shown on a hexagon chart.
  - **Weekly quests** – train 3 times, beat a record, train 4 different stats; each pays bonus XP
    and resets on Monday.
  - **Daily quest** – one small rotating task a day (10 sets, train your weakest stat, stretch,
    10 minutes of cardio) for 30 XP.
  - **Boss of the month** – one of your regular lifts, with a target 2.5 % above your best
    estimated 1RM; beat it within the month for 200 XP.
  - **Streak tokens** – every 4 weeks of streak earns a token (2 at most) that saves the streak
    through one missed week.
  - **Recovery** – each stat shows as fatigued, recovering or rested; muscles rested 48 hours earn
    10 % more set XP.
  - **Skill tree** – squat, bench, deadlift, overhead press and row are ranked Bronze to Diamond by
    estimated 1RM against your body weight (log it in Measure); pull-ups by reps.
  - **Titles and colours** – tap your name to rename the hero, wear the title of any achievement
    you've unlocked and pick an accent colour from the ranks you've reached.
  - **Reminders** – optional notifications when a streak is about to lapse, a weekly quest is one
    workout away, or the boss is about to escape (Settings).
  - **Achievements** for workouts, streaks, records, total weight lifted, quests and bosses.
  - Finishing a workout shows what it earned, with a full-screen level-up moment (and a share
    button) when you cross a level; the live workout counts XP as you tick sets off, and History
    shows the XP each workout earned.
  - Nothing is stored: the hero is replayed from your history (`src/lib/rpg.ts`), so imported,
    edited and restored workouts all count.
  - The same tab keeps the training log: workouts total, this week, week streak, workouts-per-week
    chart and training calendar.
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
  exercise/[id]     Exercise About / History / Charts / Records
src/components/     Shared UI (WorkoutEditor set grid, charts, sheets, inputs)
src/db/             SQLite schema/migrations (schema.ts), queries (repo.ts), test database (testDb.ts)
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

The goblin body map figure is drawn for this app (`src/data/goblinBody.ts`). The male and
female figures come from
[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) (MIT).
