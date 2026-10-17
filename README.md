# Apexive AI Telecom RPA

An API-backed telecom operations dashboard for KPI collection, threshold checks,
alerts, and scheduled automation jobs.

## Hourly network reports

The **Hourly Reports** dashboard groups stored KPI records by hour, network
(CS, PS, and VoLTE), and metric. It displays averages, sample counts, min/max
values, and percentage changes from the previous available hour. The page
refreshes its report every 60 seconds while open.

The backend scheduler runs an hourly KPI report, threshold-configuration check,
and anomaly scan. Use **Export Excel** to download an `.xlsx` workbook containing
the source KPI records, an hourly pivot-style summary with a line chart, and
hourly details.

This project does not include a vendor/NMS connection. Live core-network
measurements must be sent to the authenticated `POST /api/v1/kpis` endpoint by
an existing or separately configured data collector. Without that feed, hourly
reports can only summarize data already stored in the application.

## Run locally

Install backend dependencies from `backend/requirements.txt` and start the API
from the repository root with `uvicorn app.main:app --app-dir backend`. Set
`API_TOKEN` in the backend environment before connecting the dashboard. In
`frontend`, install the npm dependencies and run `npm run dev`.
