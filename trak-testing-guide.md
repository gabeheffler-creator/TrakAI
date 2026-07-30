# TrakAI — Manual Testing Guide

> **Demo credentials**
> | Role | Username | Password |
> |------|----------|----------|
> | Coach | `coach` | `coach` |
> | Client 1 | `alex` | `alex` |
> | Client 2 | `sam` | `sam` |
> | Client 3 | `jordan` | `jordan` |

> **Mobile note:** The mobile apps (`/trak-client-mobile`, `/trak-coach-mobile`) are full iframes of the web apps with `?mobile=1`. Every web test should also be verified on mobile unless marked **web-only**.

Mark each item ✅ pass / ❌ fail / ⚠️ partial as you go.

---

## 1 — Authentication

### 1.1 Coach Login
- [ ] Visit `/` — redirected to `/login`
- [ ] Submit with wrong password — error shown
- [ ] Submit with `coach / coach` — land on Dashboard
- [ ] Refresh page — session persists, still logged in
- [ ] Click Logout (Settings page) — returned to login

### 1.2 Client Login
- [ ] Visit client app — redirected to `/login`
- [ ] Tap "Alex Johnson" demo shortcut — credentials auto-fill
- [ ] Submit — land on Dashboard
- [ ] Refresh — session persists

---

## 2 — Coach App

### 2.1 Dashboard
- [ ] Page loads with client list and activity
- [ ] "Needs Attention" cards are visible
- [ ] Click a client card → navigates to that client's profile
- [ ] "View all clients" link → navigates to `/clients`
- [ ] Client activity heatmap button opens correctly
- [ ] Dismiss "AI nutrition model updated" banner (× button)

### 2.2 Clients — List Page (`/clients`)
- [ ] All 3 demo clients shown (Alex, Sam, Jordan)
- [ ] Search box filters by name in real time
- [ ] Toggle between **Grid** and **List** view
- [ ] Click a client card → opens client profile
- [ ] Click **Add Client** → sheet opens with Name / Email / Phone / Goal fields
  - [ ] Submit with valid data → new client appears in list
- [ ] Deactivate a client (trash/deactivate icon) → confirmation dialog appears → confirm → client marked inactive
- [ ] Reactivate the same client (user icon)

### 2.3 Client Profile — Header
- [ ] Profile loads for Alex (id shown, name, goal)
- [ ] Click **Edit Client** → dialog opens with pre-filled name/email/phone/goal
  - [ ] Change name → save → header updates
- [ ] Click **New Goal** → dialog opens for goal text + target date
  - [ ] Add a goal → appears in goal history

### 2.4 Client Profile — Overview Tab
- [ ] Weight trend chart renders with data points
- [ ] Hover a data point → tooltip shows date + weight
- [ ] Latest measurements summary visible
- [ ] **Assign Program** button → opens program selection dialog
  - [ ] Select a program → assignment saved, Program tab updates

### 2.5 Client Profile — Program Tab
- [ ] Assigned program name shown
- [ ] **Edit Program** → navigates to Program Builder for that program
- [ ] **Sync from template** button visible if program has a template → confirmation dialog appears
- [ ] **Program history** expander → shows prior assignments

### 2.6 Client Profile — Workouts Tab
- [ ] Workout sessions list loaded (Alex has 12 sessions)
- [ ] Click a session → expands to show exercises and sets
- [ ] All set logs (weight, reps) visible inside expanded session

### 2.7 Client Profile — Measurements Tab
- [ ] Measurement history shown (9 entries for Alex)
- [ ] Weight, body fat %, and tape measurements visible
- [ ] Chart(s) render without errors

### 2.8 Client Profile — Sleep Tab
- [ ] Sleep log list shown
- [ ] Timeframe dropdown changes the visible range (7d / 1m / 6m / 1y / All)
- [ ] Daily hours and quality visible per entry

### 2.9 Client Profile — Nutrition Tab
- [ ] **Set Daily Nutrition Goal** button → dialog opens
  - [ ] Switch between **All Days / Training / Rest** tabs
  - [ ] Adjust calorie input — macro drum-dials respond
  - [ ] Scroll a drum-dial (protein/carbs/fat %) — value updates
  - [ ] Total % indicator shows correct sum
  - [ ] Save → goal persists on reload
- [ ] Delete a nutrition goal (Remove goal button) → goal cleared
- [ ] Timeframe filter changes the log display
- [ ] Dates with MFP screenshots show thumbnail images (Alex: 5 days, Sam: 6 days, Jordan: 5 days)
- [ ] Macro totals (kcal · P · C · F) shown in date header for screenshot days
- [ ] Tap a screenshot image → opens full size (or zooms)
- [ ] "Training day" / "Rest day" tag visible on days with workout logged

### 2.10 Client Profile — Photos Tab
- [ ] Progress photos shown (3 per client — front week 1, front week 6, back week 6)
- [ ] Timeframe filter works
- [ ] Photos display correctly (not broken placeholder)

### 2.11 Client Profile — Tasks Tab
- [ ] Existing tasks shown (completed + pending)
- [ ] **Create Assignment** → dialog with Title / Type / Body / Target date / Due date
  - [ ] Submit → task appears in list
- [ ] Click ✓ icon on a pending task → toggles to complete
- [ ] Click ✓ icon on a completed task → toggles back to pending
- [ ] Delete task (trash icon) → task removed
- [ ] Rejected tasks (from client side): **Suggest Alternative** / **Leave alone** buttons visible

### 2.12 Client Profile — Messages Tab
- [ ] Conversation history shown
- [ ] Type a message → click Send → message appears in thread
- [ ] Message shows on correct side (coach = right-aligned)

### 2.13 Client Profile — Notes Tab
- [ ] **Add Private Note** textarea → type + click Add → note appears
- [ ] Edit a note (pencil icon) → inline edit → save
- [ ] Delete a note (trash icon) → removed
- [ ] **Log Manual Call** form → fill date/duration/notes → save → call log appears
- [ ] Edit/delete a call log
- [ ] Timeframe and sort filters change the notes display

### 2.14 Programs (`/programs`)
- [ ] All coach programs listed (5 pre-built templates + any custom)
- [ ] Toggle **Grid / List** view
- [ ] Search/filter programs by name
- [ ] **New Program** button → sheet with Name / Description / Duration
  - [ ] Submit → program appears in list
- [ ] **Build AI Program** toggle inside New Program sheet → additional fields appear (client goal, duration)
  - [ ] Submit → AI generates program structure
- [ ] Edit a program (pencil icon) → sheet with pre-filled data → save updates it
- [ ] Delete a program (trash icon) → program removed
- [ ] Click a program card → navigates to Program Builder

### 2.15 Program Builder (`/programs/:id`)
- [ ] Program name and structure loaded
- [ ] **Edit program** toggle button — switches to edit mode
- [ ] **Back arrow** in edit mode → returns to view mode (not navigation away)
- [ ] Back arrow in view mode → navigates to `/programs`
- [ ] **Add Phase** (+ icon) → dialog with name/weeks/days-per-week → saved
- [ ] Edit phase (pencil) → dialog pre-filled → save updates
- [ ] Delete phase (trash) → phase removed
- [ ] Set phase nutrition goal (🍎 icon) → dialog with calorie/macro fields → saved
- [ ] **Add Day** within a phase → dialog with name/day-number/notes → saved
- [ ] Delete day (trash)
- [ ] Set day nutrition override (🍎 icon) → override shown → Revert button clears it
- [ ] **Add Exercise** to a day → dialog with exercise picker, sets/reps/weight/rest/notes/RPE fields → saved
- [ ] Drag-to-reorder exercises within a day (grip handle)
- [ ] Delete an exercise (trash icon)
- [ ] **Sleep auto-adjustment** toggle (switch) — enable/disable
- [ ] Edit volume reduction % when sleep adjustment is on
- [ ] **Nutrition Periods** section → Add Period with date range + macros → saved
- [ ] Edit existing nutrition period → save
- [ ] Delete a nutrition period
- [ ] **Assign Program** button (full-width at bottom) → opens client selection dialog → select clients → assign
- [ ] **Save template changes** → propagation dialog appears when clients are assigned

### 2.16 Exercises (`/exercises`)
- [ ] All exercises listed
- [ ] Search box filters in real time
- [ ] Toggle **Grid / List** view
- [ ] **Sort** button → sheet opens with multiple sort criteria (target, compound, movement, cardio, mobility, strength)
  - [ ] Select 2+ criteria → numbered badges show priority order
  - [ ] Clear button resets
  - [ ] Apply button closes sheet and list re-sorts
- [ ] Click an exercise card → detail panel slides in with description and video
- [ ] In detail panel: **Edit** (pencil) → fields become editable
  - [ ] Modify name/description → save → updates shown
- [ ] **Upload video** button → file input opens
- [ ] Close detail panel (×)
- [ ] **Add Exercise** → dialog with name / muscle group / type / movement pattern / description → submit → appears in list

### 2.17 Messages (`/messages`)
- [ ] Client list visible on left (or full page on mobile)
- [ ] Click a client → conversation thread loads
- [ ] Type a message → send → appears in thread
- [ ] Unread count badge on nav item clears after viewing thread

### 2.18 Goal History (`/clients/:id/goal-history`)
- [ ] Accessible from client profile header "New Goal" area or direct URL
- [ ] All historical goals shown with dates

### 2.19 Settings (`/settings`)
- [ ] **Dark mode** toggle — UI switches theme
- [ ] **Progress bar** toggle — changes bar style
- [ ] **Beta mode** toggle
- [ ] **Unit system** selector (Imperial / Metric)
- [ ] **Send feedback** button → sheet opens with textarea → submit
- [ ] **Report a bug** button → sheet opens with textarea → submit
- [ ] **Logout** → session cleared, redirected to login

---

## 3 — Client App

### 3.1 Dashboard (`/`)
- [ ] Greeting and today's tasks/workout visible
- [ ] Pending tasks shown with "Mark complete" buttons
- [ ] Tap a pending task → marked complete, updates list
- [ ] Upcoming workout block visible if program assigned
- [ ] Tap workout block → navigates to `/workout`
- [ ] Nutrition summary card visible
- [ ] Sleep summary card visible
- [ ] Today's MFP screenshot (if logged) shown in nutrition card
- [ ] Quick-links to other sections work

### 3.2 Workout — Pre-workout (`/workout`)
- [ ] Today's programmed workout shown (or "No workout today")
- [ ] Exercise list with sets/reps/weight targets
- [ ] Sleep/energy reduction notice shown if last night's sleep was poor
- [ ] **Start Workout** button → enters active workout mode
- [ ] **View description** button on each exercise (if description/video exists) → opens sheet

### 3.3 Workout — Active Mode
- [ ] First exercise shown with set targets
- [ ] **Log Set** button → marks set done, shows RPE selector
- [ ] RPE (1–10) selector → confirm → confirm sound plays, moves to next set
- [ ] Rest timer starts after logging a set, counts down
- [ ] Rest timer ring animation visible
- [ ] **Skip rest** button → skips timer
- [ ] After all sets: next exercise loads automatically
- [ ] **Swap Exercise** button → opens exercise swap browser
  - [ ] Search for an alternative exercise
  - [ ] Tap exercise → confirm swap → workout continues with new exercise
- [ ] **Finish Early** button → confirmation dialog → ends workout
- [ ] **Cancel Workout** button → confirmation dialog → returns to workout screen without saving

### 3.4 Workout — Completion
- [ ] After last set of last exercise → workout complete screen
- [ ] Completion sound plays
- [ ] Duration shown
- [ ] Option to log a note/video form upload (if applicable)
- [ ] **Save & finish** → navigates away, workout saved

### 3.5 Workout History (`/workouts`)
- [ ] List of all past workout sessions (Alex has 12)
- [ ] Expand a card → shows exercises, sets, weight, reps
- [ ] Click a workout card → opens detail page `/workouts/:logId`
- [ ] Detail page shows all sets with edit capability
  - [ ] Click a set → inline edit mode for reps/weight
  - [ ] Save or cancel edit

### 3.6 Nutrition (`/nutrition`)
- [ ] Defaults to today's date
- [ ] **← →** day navigation buttons work
- [ ] **Calendar icon** → date picker popover → select a past date
- [ ] Daily calorie/macro goal shown at top (if set by coach)
- [ ] **Add meal slot** button → new meal photo box appears
- [ ] **Remove meal slot** button → removes a slot
- [ ] **Upload MFP screenshot** → tap photo box → file picker opens → select image
  - [ ] Image appears as preview
  - [ ] AI extracts macros → "AI Extracted Macros" card appears with cal/P/C/F/sodium
  - [ ] **Edit** macros (pencil) → input fields appear → save
- [ ] **Can't track** toggle → text area + calorie guess inputs appear
  - [ ] Toggle again → returns to photo mode
- [ ] **Water tracker** → + button increments glasses, − decrements
- [ ] **Submit Day** button → saves all entries
- [ ] Previously submitted day: data loads back on return to that date

### 3.7 Stats (`/stats`)
- [ ] Three tabs: **Training**, **Body**, **Photos**
- [ ] **Training tab**: Charts for volume / session count / PRs — timeframe selector (1w / 1m / 3m / 6m / all)
- [ ] **Body tab**: Weight trend chart, body fat % chart, toggle between Charts and History views
- [ ] **Photos tab**: Progress photo grid with comparison feature
  - [ ] Select two photos → side-by-side compare view
- [ ] Fullscreen chart toggle works on any chart

### 3.8 Photos (`/stats` → Photos sub-tab or dedicated `/photos`)
- [ ] **Add progress photo** button → opens upload dialog with notes field → select image → save → photo appears
- [ ] Progress photos grid shown (Alex/Sam/Jordan each have 3 seeded photos)
- [ ] Delete a progress photo (trash icon) → confirmation → removed
- [ ] **MFP Diary Photos** section at bottom
  - [ ] Screenshots shown for seeded days (Alex: 5, Sam: 6, Jordan: 5)
  - [ ] Delete an MFP photo (trash icon) → removed
  - [ ] Photos not showing as broken placeholder

### 3.9 Sleep (`/sleep`)
- [ ] Sleep history shown (extensive entries Feb–Jun)
- [ ] Timeframe filter works (7d / 1m / 6m / 1y / All)
- [ ] **Log Sleep** button → form with date / hours slept / quality (poor–great) / energy (1–10) / notes
  - [ ] Submit → new log appears
- [ ] Delete a sleep log (trash icon) → removed
- [ ] **Connect alarm** button → app picker sheet appears
  - [ ] Shows alarm app options
- [ ] Weekly average shown in header or summary area

### 3.10 Measurements (`/measurements`)
- [ ] Measurement history shown (9 entries, Feb–Jun)
- [ ] Timeframe filter works
- [ ] Charts render (weight, body fat, arm, waist, etc.)
- [ ] **Log** button → form opens with:
  - Date, Weight, Body Fat %, Chest, Waist, Hips, Arms, Thighs, Calves, Notes
  - [ ] Submit → new entry appears in history and chart updates
- [ ] Delete a measurement entry → removed

### 3.11 Calendar (`/calendar`)
- [ ] Today visible and highlighted
- [ ] Scheduled workout blocks visible on correct days
- [ ] Expand a day card → see workout / nutrition / sleep / task entries
- [ ] Tap a workout block → link to that workout log
- [ ] **Full calendar** button → full-month overlay appears
  - [ ] ← / → month navigation works
  - [ ] **Back arrow** in overlay closes it (not the X button)
  - [ ] Click a date in full calendar → jumps list view to that date
- [ ] **List / Grid** view toggle works
- [ ] "Scroll to today" works if scrolled away

### 3.12 Exercises (`/exercises`)
- [ ] All exercises listed
- [ ] Search input filters in real time
- [ ] Category filter chips (Strength, Cardio, etc.) work
- [ ] Toggle Grid / List view
- [ ] **Filter / Sort** button → sheet with multi-criteria sort → numbered badges
- [ ] Tap an exercise → detail overlay opens with description
- [ ] If exercise has a video URL → YouTube embed shown (or video player)
- [ ] Close overlay (back/×)

### 3.13 Tasks (`/tasks`)
- [ ] Pending tasks from coach shown (Alex/Sam/Jordan each have 3 pending)
- [ ] **Mark Complete** button on each → task marked done
- [ ] Completed tasks shown separately
- [ ] Back navigation to Dashboard works

### 3.14 Messages (`/messages`)
- [ ] Conversation with coach shown
- [ ] All seeded messages visible (Alex has 15, Sam 13, Jordan 13)
- [ ] Type a message → send → appears in thread
- [ ] Emoji picker button → emoji panel opens → select emoji → added to input
- [ ] **Task cards in chat** — if coach sent a task via chat:
  - [ ] **Accept** button → task accepted confirmation
  - [ ] **Reject** button → rejection reason dialog → submit

### 3.15 Settings (`/settings`)
- [ ] **Dark mode** toggle
- [ ] **Unit system** selector (Imperial / Metric) — affects measurement units across app
- [ ] **Exercise display** selector (List / One-at-a-time)
- [ ] **Progress style** selector (Bar / Ratio)
- [ ] **Send feedback** → sheet with textarea → submit
- [ ] **Report a bug** → sheet with textarea → submit
- [ ] **Import data** link → navigates to `/data-import`
- [ ] **Logout** → session cleared

### 3.16 Data Import (`/data-import`)
- [ ] Page loads without error
- [ ] CSV import instructions visible
- [ ] File upload or import action available

### 3.17 Goal History (`/goal-history`)
- [ ] Historical nutrition goals listed with dates and values

---

## 4 — Cross-Side Flows (Coach ↔ Client)

These require switching between the coach and a client account to verify end-to-end.

### 4.1 Task Assignment Flow
1. **Coach**: Go to Alex's profile → Tasks tab → Create Assignment with title "Test task" and due date
2. **Client (alex)**: Open Messages → verify task card appears in chat
3. **Client**: Tap **Accept** on the task card
4. **Coach**: Go to Alex's profile → Tasks tab → verify task shows as accepted
- [ ] All 4 steps pass

### 4.2 Task Rejection + Coach Response
1. **Client (alex)**: Reject a task in Messages with reason "Too hard right now"
2. **Coach**: Go to Alex → Tasks tab → rejected task visible with reason
3. **Coach**: Click **Suggest Alternative** → send alternative via message
4. **Client**: New alternative visible in Messages
- [ ] All 4 steps pass

### 4.3 Nutrition Goal Visibility
1. **Coach**: Alex profile → Nutrition tab → Set training-day goal (2800 kcal, P:210g, C:298g, F:67g)
2. **Client (alex)**: Open Nutrition tab → today's macro goal shown at top
3. **Coach**: Set a rest-day goal (2400 kcal)
4. **Client**: On a rest day, correct rest-day goal shown
- [ ] All 4 steps pass

### 4.4 Program Workout Flow
1. **Coach**: Verify Alex has a program assigned (Overview tab)
2. **Client (alex)**: Go to `/workout` → today's programmed session visible
3. **Client**: Start workout → complete all sets → finish
4. **Coach**: Alex → Workouts tab → new session appears with sets/weights logged
- [ ] All 4 steps pass

### 4.5 Messages — Real-time Exchange
1. **Coach**: Open Alex's Messages tab → type "How's training going?"
2. **Client (alex)**: Open Messages → message visible
3. **Client**: Reply "Great, hit a PR today!"
4. **Coach**: Reply visible in coach Messages
- [ ] All 4 steps pass

### 4.6 Progress Photos — Coach View
1. **Client (alex)**: Go to Stats → Photos → Add a progress photo
2. **Coach**: Alex profile → Photos tab → new photo visible
- [ ] Both steps pass

### 4.7 MFP Screenshot — Coach View
1. **Coach**: Alex profile → Nutrition tab → confirm seeded MFP screenshots visible with macro badges
2. **Coach**: Sam profile → Nutrition tab → confirm 6 MFP screenshot days visible
3. **Coach**: Jordan profile → Nutrition tab → confirm 5 MFP screenshot days visible
- [ ] All 3 pass

### 4.8 Sleep → Workout Adjustment
1. **Coach**: Ensure Alex's program has sleep auto-adjustment enabled (Program Builder → Sleep toggle)
2. **Client (alex)**: Log a poor sleep night (4h, poor quality)
3. **Client**: Go to workout → notice should appear about reduced volume
- [ ] Adjustment notice visible

---

## 5 — Mobile-Specific Checks

Switch to the **mobile preview** (`/trak-client-mobile` or `/trak-coach-mobile`) for these.

### 5.1 Navigation
- [ ] Bottom tab bar visible on client mobile
- [ ] All nav tabs tappable and navigate correctly
- [ ] Back gestures / back arrows work on drill-down pages (workout detail, client profile)

### 5.2 Workout on Mobile
- [ ] Full active workout flow usable on mobile viewport
- [ ] Rest timer visible and readable
- [ ] Set logging buttons large enough to tap
- [ ] Swap exercise sheet opens and scrolls properly

### 5.3 Nutrition on Mobile
- [ ] Date navigation buttons accessible
- [ ] Photo upload box tappable
- [ ] Water tracker +/− buttons work
- [ ] AI macros card readable

### 5.4 Calendar on Mobile
- [ ] Full calendar overlay opens without layout overflow
- [ ] Back arrow visible and not overlapping month navigation chevrons
- [ ] Day cards expand/collapse correctly

### 5.5 Coach Client Profile on Mobile
- [ ] Tab bar scrolls horizontally without breaking
- [ ] Drum-dial in nutrition goal dialog scrollable
- [ ] Program builder navigable
- [ ] Messages input visible above keyboard (not obscured)

### 5.6 Messages on Mobile
- [ ] Chat input stays accessible (not hidden behind keyboard)
- [ ] Long messages wrap correctly
- [ ] Task cards in chat readable

---

## 6 — Edge Cases & Error States

- [ ] **No program assigned**: Client goes to `/workout` → "No workout scheduled" or empty state shown gracefully
- [ ] **Empty nutrition day**: Client views a day with no logs → empty state shown, not a crash
- [ ] **Offline / server down**: App shows error state with retry button, not a blank crash
- [ ] **Coach views client with no data**: Fresh client with no measurements/sleep/workouts → empty states on each profile tab (not broken)
- [ ] **Program with no phases**: Program builder opens with auto-edit mode enabled, prompts to add phases
- [ ] **Wrong credentials**: Login shows error message, does not hang
- [ ] **Long client name**: Client list and messages display long names without overflow/truncation issues

---

## 7 — Sounds & Feedback (Client App)

- [ ] Navigating between tabs plays a short tick sound
- [ ] Logging a set plays a ring/confirm sound
- [ ] Completing a workout plays the completion sound
- [ ] Sounds respect device mute where applicable

---

## Notes

- All workflows should be **running** before testing: api-server, trak-coach, trak-client, trak-coach-mobile, trak-client-mobile
- After running the seed script, demo data covers Feb–Jun 2026
- Today's date is July 30, 2026 — tasks with July due dates should appear as **pending**
- MFP screenshots appear on specific historical dates; navigate to those dates in the Nutrition tab to verify (Alex: Feb 3, Mar 3, Apr 7, May 19, Jun 4)
