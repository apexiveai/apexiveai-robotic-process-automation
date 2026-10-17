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

## Network topology dashboard

The **Network Topology** view provides an interactive MPT-style RAN/core
diagram, node status indicators, a selected-node details panel, Yangon cell
KPI snapshots, animated traffic-flow styling, and a 100-page node inventory.
Click a topology node or cell to inspect it; use the inventory pager to browse
pages 1–100.

Topology nodes and cell KPIs are currently local demo data, not live MPT
measurements. The displayed refresh time is a UI demonstration only. Connect a
verified vendor/NMS collector and expose its node, cell, alarm, and traffic
telemetry through an authenticated API before using this view for operational
decisions.

## NOC operations workspace

The navigation is organized into Monitoring, Automation, Analytics, and
Administration. The prototype includes a clickable Myanmar region map, PGW/IMS
service dependency impact view, a selectable 24-hour KPI timeline, and an
illustrative AI prediction page. The timeline loads the existing hourly report
when an API token is connected; without report data it clearly labels its
series as demo values.

Workflow Monitor, RPA Execution History, Performance Analytics, Traffic
Analytics, Service Health, API / Integration, and System Settings provide
navigation into the currently implemented dashboard/report views. They are
not separate production services or integrations yet. Regional health,
dependency impacts, predictions, and displayed NOC KPIs are demo content until
an authenticated NMS/vendor telemetry source and validated service inventory
are connected.

## Run locally

Install backend dependencies from `backend/requirements.txt` and start the API
from the repository root with `uvicorn app.main:app --app-dir backend`. Set
`API_TOKEN` in the backend environment before connecting the dashboard. In
`frontend`, install the npm dependencies and run `npm run dev`.

User: 1. 🛰️ Live MPT Network Topology — အဓိကထည့်

                    MPT NETWORK
                         │
              ┌──────────┴──────────┐
              │                     │
           RAN / BTS              CORE
              │                     │
      ┌───────┼───────┐       ┌─────┼─────┐
      │       │       │       │     │     │
     2G      3G      4G      CS     PS   VoLTE
      │       │       │       │     │     │
     BTS     NodeB   eNB     MSC    PGW   IMS
                              │      │
                           HLR/HSS   SGW

    UI မှာ node တစ်ခုချင်းစီကို **live status** နဲ့ပြမယ်။
    
    - 🟢 **ONLINE**
    - 🟡 **DEGRADED**
    - 🔴 **CRITICAL**
    - ⚫ **OFFLINE**
    Node ကို click လုပ်ရင် right-side panel မှာ—
 
 NODE DETAILS
────────────────────
Node ID       MPT-CORE-04
Type          PGW
Region        Yangon
Status        ONLINE

CPU           42%
Memory        61%
Traffic       1.82 Gbps
Sessions      84,291

Latency       18 ms
Packet Loss   0.2%

Last Check    16:08:42

### 2. 📡 BTS / Cell Monitoring
Topology ထဲမှာ **BTS → Cell → eNodeB → Core** အထိ drill-down လုပ်နိုင်အောင်ထားမယ်

ဥပမာ—
YANGON
 ├── AHLONE
 │    ├── AHLONE-001 🟢
 │    ├── AHLONE-002 🟢
 │    └── AHLONE-003 🔴
 │
 ├── NayPyiTaw
 │    ├── NPT-001 🟢
 │    └── NPT-002 🟡
 │
 └── HANTHARWATI
      └── HTWT-001 🟢

      **Cell-level KPI**
      
      - Active Users
      - Traffic
      - Throughput
      - RSRP
      - RSRQ
      - SINR
      - Drop Rate
      - Call Setup Success Rate
      - Handover Success Rate
      - Availability

### 3. 🔥 Real-time Traffic Flow
      Topology line တွေကို static မထားဘဲ **animated data flow** လုပ်

      ဥပမာ—
      BTS ── 820 Mbps ──▶ eNodeB ── 1.4 Gbps ──▶ SGW ── 1.2 Gbps ──▶ PGW ──▶ INTERNET

---

### 4. 🚨 Alarm / Incident Overlay
Topology မှာ critical alarm badge ပြပြီး badge သို့မဟုတ် alarm row ကိုနှိပ်လျှင် incident detail နှင့် impact path ကိုဖွင့်ပြမယ်။

        🔴 CRITICAL
        AHLONE-003
           │
           ▼
       eNodeB-07
           │
      ┌────┴────┐
      │         │
    PGW-01    PGW-02
      🟢         🟢

      Alarm တစ်ခု click →
ALARM #MPT-20261017-0842

Severity       CRITICAL
Node           AHLONE-003
KPI            Cell Availability
Current        91.4%
Threshold      95%

Started        16:02
Duration       07m 42s

AUTO ACTION
✓ Incident created
✓ Engineer notified
✓ RPA diagnostic started

ဤ incident နှင့် auto-action status များသည် UI demo data ဖြစ်ပြီး၊ live alarm ingestion သို့မဟုတ် တကယ့် engineer notification / diagnostic action မဟုတ်သေးပါ။

---

### 5. 🤖 RPA Automation Status
Topology ထဲမှာ **Automation Engine** status နဲ့ active incident workflow ကို တိုက်ရိုက်ချိတ်ပြမယ်။

AUTOMATION ENGINE
────────────────────

Hourly KPI Collection      🟢 RUNNING
Traffic Report              🟢 COMPLETED
Threshold Monitoring        🟢 RUNNING
Alarm Detection             🟢 RUNNING
Daily Report Generation     🟢 SCHEDULED
Incident Analysis           🟡 2 QUEUED

ပြီးတော့—

**“Why is this node RED?”**

ဆိုရင် RPA engine က

1. Detect abnormal KPI
2. Collect related KPIs
3. Compare threshold
4. Identify affected cells
5. Generate incident
6. Notify operation team
7. Generate report

အထိ workflow ပြ

`Why is this node RED?` ကိုနှိပ်လျှင် AHLONE-003 alarm အတွက် အဆင့် ၇ ဆင့်နှင့် evidence ကို ဖွင့်ပြမယ်။ လက်ရှိ job status နဲ့ workflow သည် UI demo trace သာဖြစ်ပြီး တကယ့် job execution, engineer notification, သို့မဟုတ် report generation မလုပ်ပါ။

### 6. 📊 Core Network Health
Top-level KPI cards ထည့်

NETWORK HEALTH
98.7%

RAN AVAILABILITY
99.2%

CORE HEALTH
99.8%

VoLTE SUCCESS
97.6%

DATA TRAFFIC
18.42 TB

ACTIVE USERS
2.84 M

ACTIVE ALARMS
07

ဤ KPI တန်ဖိုးများသည် UI demo data ဖြစ်ပြီး production network telemetry မဟုတ်ပါ။ Production အသုံးပြုရန် authenticated NMS/vendor telemetry feed ချိတ်ဆက်ရန်လိုသည်။

7. 🌍 Myanmar Geographic Topology
မြန်မာ map ပေါ်မှာ—
                 MYANMAR
        ┌────────────────────┐
        │  Mandalay    🟢    │
        │                    │
        │ Yangon 🔴          │
        │                    │
        │ Naypyidaw 🟢       │
        │                    │
        │ Dawei       🟡     │
        └────────────────────┘

        Region တစ်ခု click → BTS / Cell / KPI တွေ drill-down။

### 8. 🔗 Network Dependency Map
Node တစ်ခု down သွားရင် **ဘယ် service တွေထိခိုက်မလဲ** ပြပါ။

PGW-01 🔴
   │
   ├── Internet Data 🔴
   ├── Mobile Data 🔴
   └── Enterprise VPN 🟡

IMS-02 🔴
   │
   └── VoLTE 🔴
       ├── Voice
       └── SMS over IMS

       ### 9. 📈 Historical KPI Timeline
       Hourly Report နဲ့ ချိတ်ပြီး—

       24H NETWORK PERFORMANCE

100% ─────────────────────
 98% ───╮──────╭─────────
 96% ───╰──╮───╯─────────
 94%      ╰─╮
             ╰───────────
      00 04 08 12 16 20

      Metric ပြောင်းနိုင်ရမယ်—
      
      **Availability / Traffic / CSSR / DCR / VoLTE / Latency**

---

### 10. 🧠 AI / Predictive Operations
နောက်ဆုံး layer အနေနဲ့—
APEXIVEAI INTELLIGENCE
────────────────────────

⚠️ Predicted Incident

Cell: AHLONE-003
Probability: 87%

Expected degradation:
~ 18 minutes

Reason:
• Rising packet loss
• Increasing latency
• Traffic imbalance

Recommended Action:
→ Run diagnostic workflow

APEXIVEAI TELECOM NOC + RPA + AI OPERATIONS PLATFORM လုပ်ပေး

MONITORING
├── Overview
├── Network KPIs
├── Network Topology       ← NEW ⭐
├── Geographic Map         ← NEW
├── Hourly Reports
├── Alarm / Incident Center
└── Service Health         ← NEW

AUTOMATION
├── Automation Jobs
├── Workflow Monitor       ← NEW
├── RPA Execution History  ← NEW
└── Thresholds

ANALYTICS
├── Performance Analytics  ← NEW
├── Traffic Analytics      ← NEW
└── AI Predictions         ← NEW

ADMINISTRATION
├── License
├── API / Integration
├── Audit Logs
└── System Settings

Overview → Topology → Network KPIs → Hourly Reports → Alerts → Automation

တကယ့် **Telecom NOC / Network Operations Control Center**

အဖြစ်တည်ဆောက်ချင်တယ်။