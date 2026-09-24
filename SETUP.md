# Live Google Calendar booking setup

The updated `index.html` no longer uses hard-coded appointment times. It asks a Google Apps Script backend for the days and times that are actually free in the salon's Google Calendar.

## 1. Create the backend

1. Sign in to the Google account that owns the salon calendar.
2. Open https://script.google.com and create a **New project**.
3. Replace the contents of `Code.gs` with the provided `Code.gs` file.
4. Open **Project Settings** and set the time zone to **America/Sao_Paulo**.
5. If the salon uses the account's main calendar, leave `CALENDAR_ID: ''` as-is. If it uses a dedicated calendar, paste that calendar's ID into `CALENDAR_ID`.
6. Click **Deploy → New deployment → Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone**.
9. Authorize the Calendar permission when Google asks.
10. Copy the deployment URL ending in `/exec`.

## 2. Connect the website

In `index.html`, find:

```js
const SCHEDULER_API_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Replace the placeholder with the `/exec` URL from step 10.

Example:

```js
const SCHEDULER_API_URL = 'https://script.google.com/macros/s/ABC123.../exec';
```

Commit/push the changed `index.html` to the GitHub Pages repository.

## 3. How it works

- The website displays only Tuesday-Saturday dates that still contain at least one free appointment time.
- Selecting a date displays only that date's free times.
- Availability is read directly from the salon Google Calendar.
- A submitted website reservation is written to the salon Google Calendar immediately and blocks the time so another visitor cannot reserve it.
- If Isis does not accept the appointment, delete that event from Google Calendar. The time will automatically become available on the website again.
- The page refreshes availability every 60 seconds while it is open.
- The backend checks the calendar again at the exact moment of booking, preventing two simultaneous visitors from taking the same slot.

## 4. Appointment duration

The original website treated every service as a one-hour appointment, so all services are currently configured as 60 minutes in `Code.gs`.

Change the numbers in `SERVICE_DURATION_MINUTES` once you know the real duration of each service. The website will automatically calculate which start times can fit before closing time.

## 5. Privacy

The public website receives only free dates and times. It does **not** receive the titles, client names, phone numbers, or descriptions from existing Google Calendar events.
