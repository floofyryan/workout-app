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
- **Weekly plan** – schedule templates on the days you train (Workout tab → Plan). The Workout tab
  shows "This week" with a day strip (done / missed / upcoming, plus unplanned extras) and a one-tap
  start for today's workout. Doing a planned workout on another day still ticks it off; days from
  before the plan was set up don't count as missed. Copy a day to another, or clear the plan.
- **Program generator** – tick the equipment you have (presets for full gym, home gym, dumbbells,
  bodyweight), your training days and goal (strength, muscle, general fitness), and it builds a
  full-body, upper/lower or push/pull/legs program from the curated exercise library, with sets,
  reps and rest times. Shuffle for different exercises, then save it as templates in a folder and,
  optionally, as your weekly plan. Saving again doesn't make lookalikes: if "Upper A" already
  exists, the new one is "Upper A (1)", then "Upper A (2)", and so on.
- **Live workout** – elapsed timer, editable name and notes, and per exercise a
  `SET | PREVIOUS | KG | REPS | ✓` grid:
  - "Previous" shows what you did last time; tap it to copy those values. Ticking a set with blank
    fields fills them from last time (or the set above).
  - Set types: normal, warm-up (W), drop (D), failure (F) — tap the set number.
  - Auto-generated warm-up sets, per-exercise notes, replace / remove exercises, and drag-to-reorder
    them. Swipe a set left to delete it.
  - **Supersets** – link an exercise with the next one ("Superset with …" in its menu); the rest
    timer only starts after the last exercise of each round.
  - Rest timer starts when you tick a set (±15 s, skip, beeps and vibrates when done). The beep turns
    down any music or podcast that's playing just while it sounds, then lets it come back up
    (can be turned off in Settings). Rest time is
    configurable per exercise, per template exercise, or globally.
  - Timed holds (plank, wall sit, stretches…) get a ▶ button: it counts down the set's time
    (or last session's, or 1:00), buzzes, ticks the set off and starts the rest timer
    automatically. ±15 s, Done (records the time held so far) and Cancel while it runs.
  - With the screen off or the app in the background, a notification tells you when a hold or rest
    is over (can be turned off in Settings).
  - Leaving the app mid-workout pops up a silent "Workout in progress" notification (name, start
    time, sets done) that stays until you come back; tapping it, or a rest/hold alert, opens the
    workout (can be turned off in Settings).
  - The workout survives the app being closed, and keeps the screen on (configurable).
  - Finishing offers to update the template if you changed its exercises or sets, or lifted different
    weights / reps, so next time it starts filled in with what you did.
  - The template and past-workout editors ask before throwing away unsaved changes.
- **Adventure mode** (on by default, can be turned off in Settings) – RPG flavour on top of the log:
  - The live workout is a **dungeon**: a little knight fights one monster per set, and ticking a set
    off slays it (sword slash, +XP). The dungeon guide says which room (exercise or superset), set and
    target is next, counts down rest ("… attacks in 1:12") and drains the monster's HP during holds.
  - Monsters depend on the exercise: golems for pushing, goblins for pulling, ogres for legs,
    skeletons for core and stretching, bats for cardio, slimes for warm-ups, a crowned elite for the
    last working set and a dragon for sets to failure. Clear every room to reach the treasure chest.
  - Every set earns **XP** (more for heavier, longer or harder sets) toward a character **level**, and
    trains one of five attributes: **STR** (upper body), **CON** (legs), **DEX** (core, plyo, Olympic
    lifts), **STA** (cardio) and **WIS** (stretching). Your highest attribute sets your class
    (Barbarian, Juggernaut, Rogue, Ranger, Monk) and your level your rank (Novice → Legendary).
  - The **Record Keeper**, a hooded wraith, guards any set planned to beat a personal record; slay
    it with a record-breaking set for a "NEW RECORD!". Level-ups pop up mid-fight too.
  - **Gear** upgrades with your rank, and the hero's look changes with it: Wooden Sword & Leather
    Tunic → Iron Sword & Chainmail (level 5) → Steel Longsword & Plate (10) → Golden Blade & Gilded
    Plate (20) → Flameblade & Dragonscale (35).
  - **Achievements** with progress bars: First Blood, Monster Hunter, Dragon Slayer, Iron Will (4-week
    streak), Centurion (100 kg set), Wanderer (5 km), Zen Master, Veteran, Renaissance Hero, Dungeon
    Regular and Legendary Slayer.
  - **Weekly quests**: three a week (a big one, a body-part one and a side quest, e.g. "Finish 3
    workouts", "Train legs in 2 workouts", "Do 6 warm-up sets"), worth 100–150 bonus XP each. Quests
    can complete mid-fight, and their XP counts toward your level.
  - **Bestiary**: all 27 monsters, with how many of each you've slain; undiscovered ones show as
    shadows with "???". New discoveries are announced when you finish a workout.
  - Profile shows the character sheet, gear, weekly quests, the bestiary and achievements; the finished-workout screen shows XP
    earned, monsters slain, level-ups, new gear, unlocked achievements and attribute gains. It's all derived from your history, so imported workouts count too.
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
- **Profile** – workouts total, this week, week streak, workouts-per-week chart, training calendar.
- **Measure** – body weight, body fat and body-part measurements with charts.
- **Tools** – plate calculator (configurable bar and plates) and 1RM calculator with percentage table.
- **Units** – metric or imperial.
- **Import / export** – import your history from a **Strong CSV export** (Strong → Settings →
  Export Strong Data); exercises are matched by name and unknown ones are created. Export
  everything as a Strong-compatible CSV, or back up / restore all data as JSON.
- **Automatic backups** – the app saves a backup of everything (templates, weekly plan, workouts,
  exercises, measurements, settings) on the phone once a week, before an app update changes the
  database, and before you restore a backup. Settings → Automatic backups lists them to restore or
  share. Updating with `build-phone.bat` installs over the existing app, so data is kept anyway.

## Running it

Requirements: Node 20+ and the [Expo Go](https://expo.dev/go) app on an Android phone (SDK 57).

```bash
npm install
npm start          # scan the QR code with Expo Go
npm run android    # or open in an Android emulator
```

## Installing on your phone without a cable (Windows)

Double-click **`install-without-usb.bat`**. It pulls the latest code, installs packages, builds the
finished app (`Workout.apk`, which runs on its own, without Metro or the computer) and then shows a
QR code. With the phone on the same Wi-Fi, scan it with the camera, tap **Download**, open the file
and tap **Install**/**Update** (the first time, allow the browser to install unknown apps). It
installs over the existing app and keeps all data, because it's signed with the same key. Never
uninstall the old app first: that deletes its data. `scripts/serve-apk.mjs` does the Wi-Fi part
and can be run on its own to re-share the last build.

## Installing on your phone (Windows, one click)

With Android Studio installed and your phone connected (USB debugging, or paired over Wi-Fi in
Android Studio → Device Manager), double-click **`build-phone.bat`**. It pulls the latest code,
installs packages, generates the Android project and installs a release build on the phone. The
`plugins/withGradleMemory.js` config plugin gives Gradle enough memory for this, so the generated
`android/` folder never needs editing.

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
  plan, generate    Weekly plan editor and program generator
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
