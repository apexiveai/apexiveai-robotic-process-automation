import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Command, Cpu,
  Database, Gauge, Globe2, LayoutDashboard, LoaderCircle,
  LockKeyhole, Menu, Network, Play, RadioTower,
  RefreshCw, RotateCcw, Search, Send, ShieldCheck,
  Signal, TerminalSquare, Wifi, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import {
  createJob, executeJob, getAlerts, getAuditLogs,
  getHealth, getJobs, getKpis, getLicense, getThresholds,
  resolveAlert, retryJob, submitKpi
} from "./api";

type Item = Record<string, any>;
type Section =
  | "Overview"
  | "Network KPIs"
  | "Alerts Center"
  | "Automation Jobs"
  | "Thresholds"
  | "License"
  | "Audit Logs";

const navItems: {
  label: Section;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Network KPIs", icon: Signal },
  { label: "Alerts Center", icon: Bell },
  { label: "Automation Jobs", icon: Bot },
  { label: "Thresholds", icon: Gauge },
  { label: "License", icon: ShieldCheck },
  { label: "Audit Logs", icon: TerminalSquare }
];

function rows(value: unknown): Item[] {
  if (Array.isArray(value)) return value.filter(Boolean) as Item[];
  if (value && typeof value === "object") {
    const object = value as Item;
    for (const key of ["items", "results", "data", "records", "alerts", "jobs", "logs", "thresholds", "kpis"]) {
      if (Array.isArray(object[key])) return object[key] as Item[];
    }
  }
  return [];
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function number(value: unknown, digits = 2) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
}

function field(item: Item, keys: string[], fallback: unknown = "—") {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return fallback;
}

function badgeClass(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized.includes("CRITICAL") || normalized.includes("FAILED") || normalized.includes("ERROR")) return "status-pill danger";
  if (normalized.includes("WARNING") || normalized.includes("PENDING") || normalized.includes("QUEUED")) return "status-pill warning";
  if (normalized.includes("NORMAL") || normalized.includes("COMPLETED") || normalized.includes("RESOLVED") || normalized.includes("ACTIVE")) return "status-pill success";
  return "status-pill neutral";
}

function StatCard({
  label, value, detail, icon: Icon, tone = "cyan"
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${tone}`}><Icon size={18} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
      <div className={`stat-line ${tone}`} />
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Database size={22} />
      <span>{text}</span>
    </div>
  );
}

function Table({
  columns, data, empty = "No records returned by the API."
}: {
  columns: { label: string; render: (item: Item) => React.ReactNode }[];
  data: Item[];
  empty?: string;
}) {
  if (!data.length) return <EmptyState text={empty} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={String(item.id ?? item.job_id ?? item.kpi_id ?? index)}>
              {columns.map((column) => (
                <td key={column.label}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [section, setSection] = useState<Section>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [network, setNetwork] = useState("all");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [kpis, setKpis] = useState<Item[]>([]);
  const [alerts, setAlerts] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Item[]>([]);
  const [thresholds, setThresholds] = useState<Item[]>([]);
  const [logs, setLogs] = useState<Item[]>([]);
  const [license, setLicense] = useState<Item | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [jobName, setJobName] = useState("Scheduled KPI Health Check");
  const [jobType, setJobType] = useState<"KPI_REPORT" | "KPI_CHECK" | "ANOMALY_SCAN">("KPI_CHECK");
  const [jobTime, setJobTime] = useState("");
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiNetwork, setKpiNetwork] = useState<"PS" | "CS" | "VoLTE">("VoLTE");
  const [metricName, setMetricName] = useState("availability");
  const [metricValue, setMetricValue] = useState("98.5");
  const [metricUnit, setMetricUnit] = useState("%");

  const loadData = useCallback(async (activeToken: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const results = await Promise.allSettled([
        getHealth(),
        getKpis(activeToken, network),
        getAlerts(activeToken),
        getJobs(activeToken),
        getThresholds(activeToken),
        getAuditLogs(activeToken),
        getLicense(activeToken)
      ]);

      const [healthResult, kpiResult, alertResult, jobResult, thresholdResult, logResult, licenseResult] = results;

      if (healthResult.status === "fulfilled") setHealth("online");
      else setHealth("offline");

      const failures: string[] = [];
      const apply = (
        result: PromiseSettledResult<unknown>,
        setter: (value: any) => void,
        label: string
      ) => {
        if (result.status === "fulfilled") setter(result.value);
        else failures.push(`${label}: ${result.reason instanceof Error ? result.reason.message : "request failed"}`);
      };

      apply(kpiResult, (v) => setKpis(rows(v)), "KPIs");
      apply(alertResult, (v) => setAlerts(rows(v)), "Alerts");
      apply(jobResult, (v) => setJobs(rows(v)), "Jobs");
      apply(thresholdResult, (v) => setThresholds(rows(v)), "Thresholds");
      apply(logResult, (v) => setLogs(rows(v)), "Audit logs");
      apply(licenseResult, (v) => setLicense(v && typeof v === "object" ? v as Item : null), "License");

      if (failures.length) {
        setError(failures.join(" · "));
      } else {
        setNotice("All dashboard endpoints responded successfully.");
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => { if (!cancelled) setHealth("online"); })
      .catch(() => { if (!cancelled) setHealth("offline"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadData(token);
  }, [token, loadData]);

  const refresh = () => {
    if (!token.trim()) {
      setError("Enter your API token to load protected dashboard data.");
      return;
    }
    void loadData(token);
  };

  const connect = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tokenInput.trim()) {
      setError("Please enter the API token.");
      return;
    }
    setToken(tokenInput.trim());
    setError("");
    setTokenInput("");
  };

  const activeAlerts = useMemo(
    () => alerts.filter((a) => String(field(a, ["status"], "OPEN")).toUpperCase() !== "RESOLVED"),
    [alerts]
  );

  const criticalCount = activeAlerts.filter(
    (a) => String(field(a, ["severity"], "")).toUpperCase() === "CRITICAL"
  ).length;

  const filteredKpis = useMemo(() => {
    const term = search.trim().toLowerCase();
    return kpis.filter((item) => {
      const networkMatch = network === "all" ||
        String(field(item, ["network_type"], "")).toUpperCase() === network.toUpperCase();
      const textMatch = !term ||
        JSON.stringify(item).toLowerCase().includes(term);
      return networkMatch && textMatch;
    });
  }, [kpis, network, search]);

  const chartData = useMemo(() => {
    const sorted = [...filteredKpis].sort((a, b) =>
      new Date(String(field(a, ["recorded_at", "created_at"], 0))).getTime() -
      new Date(String(field(b, ["recorded_at", "created_at"], 0))).getTime()
    );
    return sorted.slice(-24).map((item, index) => ({
      time: formatDate(field(item, ["recorded_at", "created_at"])),
      value: Number(field(item, ["value"], 0)),
      metric: String(field(item, ["metric_name"], `Metric ${index + 1}`))
    })).filter((item) => Number.isFinite(item.value));
  }, [filteredKpis]);

  const resolve = async (item: Item) => {
    const id = field(item, ["id", "alert_id"]);
    if (id === "—") return;
    setBusyId(id);
    try {
      await resolveAlert(token, id);
      setNotice(`Alert ${id} resolve request completed.`);
      await loadData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve alert.");
    } finally {
      setBusyId(null);
    }
  };

  const runJob = async (item: Item, retry = false) => {
    const id = field(item, ["id", "job_id"]);
    if (id === "—") return;
    setBusyId(id);
    try {
      if (retry) await retryJob(token, id);
      else await executeJob(token, id);
      setNotice(`Job ${id} request completed.`);
      await loadData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Job action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const scheduleJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!jobName.trim() || !jobTime) {
      setError("Enter a job name and schedule time.");
      return;
    }
    const scheduled = new Date(jobTime);
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
      setError("Choose a future schedule time.");
      return;
    }
    try {
      await createJob(token, {
        name: jobName.trim(),
        job_type: jobType,
        scheduled_at: scheduled.toISOString()
      });
      setNotice("Automation job created.");
      setJobName("Scheduled KPI Health Check");
      setJobTime("");
      await loadData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create job.");
    }
  };

  const addKpi = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(metricValue);
    if (!metricName.trim() || !Number.isFinite(value)) {
      setError("Enter a valid metric name and numeric value.");
      return;
    }
    try {
      await submitKpi(token, {
        network_type: kpiNetwork,
        metric_name: metricName.trim(),
        value,
        unit: metricUnit,
        source: "dashboard_manual_entry",
        recorded_at: new Date().toISOString()
      });
      setNotice("KPI submitted. Backend threshold evaluation was requested.");
      setShowKpiForm(false);
      await loadData(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit KPI.");
    }
  };

  const licenseText = license
    ? String(field(license, ["mode", "status", "license_status"], "License response received"))
    : "Not loaded";

  const renderOverview = () => (
    <>
      <div className="stats-grid">
        <StatCard label="KPI RECORDS" value={number(kpis.length, 0)} detail="Records returned by API" icon={Activity} tone="cyan" />
        <StatCard label="OPEN ALERTS" value={number(activeAlerts.length, 0)} detail={`${criticalCount} critical alerts`} icon={AlertTriangle} tone="pink" />
        <StatCard label="AUTOMATION JOBS" value={number(jobs.length, 0)} detail={`${jobs.filter((j) => String(field(j, ["status"], "")).toUpperCase() === "COMPLETED").length} completed`} icon={Bot} tone="purple" />
        <StatCard label="THRESHOLDS" value={number(thresholds.length, 0)} detail="Configured API records" icon={Gauge} tone="blue" />
      </div>

      <div className="content-grid main-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NETWORK TELEMETRY</span>
              <h2>KPI Signal Stream</h2>
              <p>Latest returned metric values</p>
            </div>
            <select value={network} onChange={(e) => setNetwork(e.target.value)} className="dark-select" aria-label="Filter network">
              <option value="all">All networks</option>
              <option value="PS">PS</option>
              <option value="CS">CS</option>
              <option value="VoLTE">VoLTE</option>
            </select>
          </div>
          <div className="chart-area">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -16, bottom: 4 }}>
                  <defs>
                    <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#24e9ff" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#24e9ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1c2940" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis tick={{ fill: "#73849e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0b1221", border: "1px solid #264056", borderRadius: 10 }}
                    labelStyle={{ color: "#9eb0c9" }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#24e9ff" strokeWidth={2.4} fill="url(#signalFill)" activeDot={{ r: 5, fill: "#ff3dbf" }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={token ? "No KPI records returned. Submit a KPI or check the backend." : "Connect with an API token to view KPI telemetry."} />
            )}
          </div>
          <div className="chart-foot"><span><i className="legend-dot cyan-dot" /> Metric value</span><span>Latest {chartData.length} points</span></div>
        </section>

        <section className="panel city-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">NEURAL NETWORK MAP</span>
              <h2>Tokyo Signal Grid</h2>
              <p>Dashboard visualization · not a geographic network map</p>
            </div>
            <span className="live-chip"><span className="pulse-dot" /> SYSTEM VIEW</span>
          </div>
          <div className="holo-map">
            <div className="map-rings"><span /><span /><span /></div>
            <svg className="network-lines" viewBox="0 0 400 280" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M35 160 L100 90 L175 130 L245 58 L355 100" />
                <path d="M48 225 L100 90 L210 210 L245 58 L320 210 L355 100" />
                <path d="M35 160 L155 190 L175 130 L320 210" />
                <path d="M100 90 L155 190 L210 210 L355 100" />
              </g>
              {[[35,160],[100,90],[175,130],[245,58],[355,100],[48,225],[155,190],[210,210],[320,210]].map(([x,y], i) => (
                <circle key={i} cx={x} cy={y} r={i === 3 ? 5 : 3} fill={i % 2 ? "#ff3dbf" : "#24e9ff"} />
              ))}
            </svg>
            <div className="city-bars">
              {Array.from({ length: 28 }, (_, i) => (
                <span key={i} style={{ height: `${18 + ((i * 31) % 85)}px`, animationDelay: `${(i % 8) * -0.4}s` }} />
              ))}
            </div>
            <div className="map-label label-one"><span /> TOKYO / CORE-01</div>
            <div className="map-label label-two"><span /> SIGNAL ROUTE</div>
            <div className="map-label label-three"><span /> NODE ONLINE</div>
            <div className="map-center"><RadioTower size={25} /><strong>AX-01</strong><small>CONTROL NODE</small></div>
          </div>
          <div className="network-legend">
            <span><i className="legend-dot cyan-dot" /> Core nodes</span>
            <span><i className="legend-dot pink-dot" /> Signal paths</span>
            <span><i className="legend-dot purple-dot" /> Automation</span>
          </div>
        </section>
      </div>

      <div className="content-grid lower-grid">
        <section className="panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">INCIDENT RESPONSE</span><h2>Priority Alerts</h2></div>
            <button className="text-button" onClick={() => setSection("Alerts Center")}>View all <ChevronRight size={15} /></button>
          </div>
          <Table data={activeAlerts.slice(0, 5)} columns={[
            { label: "METRIC", render: (i) => <strong>{field(i, ["metric_name"])}</strong> },
            { label: "SEVERITY", render: (i) => <span className={badgeClass(field(i, ["severity"]))}>{field(i, ["severity"], "UNKNOWN")}</span> },
            { label: "VALUE", render: (i) => number(field(i, ["observed_value", "value"])) },
            { label: "STATUS", render: (i) => String(field(i, ["status"], "OPEN")) }
          ]} />
        </section>
        <section className="panel">
          <div className="panel-heading compact">
            <div><span className="eyebrow">PROCESS ENGINE</span><h2>Recent Jobs</h2></div>
            <button className="text-button" onClick={() => setSection("Automation Jobs")}>View all <ChevronRight size={15} /></button>
          </div>
          <Table data={jobs.slice(0, 5)} columns={[
            { label: "JOB", render: (i) => <strong>{field(i, ["name", "job_type"])}</strong> },
            { label: "STATUS", render: (i) => <span className={badgeClass(field(i, ["status"]))}>{field(i, ["status"], "UNKNOWN")}</span> },
            { label: "SCHEDULED", render: (i) => formatDate(field(i, ["scheduled_at", "created_at"])) }
          ]} />
        </section>
      </div>
    </>
  );

  const renderKpis = () => (
    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">NETWORK INTELLIGENCE</span><h2>Network KPI Records</h2><p>Inspect metrics returned by FastAPI.</p></div>
        <button className="primary-button" onClick={() => setShowKpiForm(!showKpiForm)}><Send size={15} /> Submit KPI</button>
      </div>
      {showKpiForm && (
        <form className="inline-form" onSubmit={addKpi}>
          <label>Network<select value={kpiNetwork} onChange={(e) => setKpiNetwork(e.target.value as typeof kpiNetwork)}><option>PS</option><option>CS</option><option>VoLTE</option></select></label>
          <label>Metric name<input value={metricName} onChange={(e) => setMetricName(e.target.value)} required /></label>
          <label>Value<input type="number" step="any" value={metricValue} onChange={(e) => setMetricValue(e.target.value)} required /></label>
          <label>Unit<input value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} required /></label>
          <button className="primary-button" type="submit"><Send size={14} /> Submit</button>
        </form>
      )}
      <div className="table-toolbar">
        <div className="search-box"><Search size={15} /><input placeholder="Search KPI records..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="dark-select" value={network} onChange={(e) => setNetwork(e.target.value)}><option value="all">All networks</option><option value="PS">PS</option><option value="CS">CS</option><option value="VoLTE">VoLTE</option></select>
      </div>
      <Table data={filteredKpis} columns={[
        { label: "ID", render: (i) => field(i, ["id"]) },
        { label: "NETWORK", render: (i) => <span className="network-tag">{field(i, ["network_type"], "—")}</span> },
        { label: "METRIC", render: (i) => <strong>{field(i, ["metric_name"])}</strong> },
        { label: "VALUE", render: (i) => number(field(i, ["value"])) },
        { label: "UNIT", render: (i) => field(i, ["unit"]) },
        { label: "SOURCE", render: (i) => field(i, ["source"]) },
        { label: "RECORDED", render: (i) => formatDate(field(i, ["recorded_at", "created_at"])) }
      ]} />
    </section>
  );

  const renderAlerts = () => (
    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">INCIDENT MANAGEMENT</span><h2>Alerts Center</h2><p>Review, triage and resolve backend alerts.</p></div>
        <span className="alert-count"><AlertTriangle size={16} /> {activeAlerts.length} OPEN</span>
      </div>
      <Table data={alerts} columns={[
        { label: "ID", render: (i) => field(i, ["id", "alert_id"]) },
        { label: "SEVERITY", render: (i) => <span className={badgeClass(field(i, ["severity"]))}>{field(i, ["severity"], "UNKNOWN")}</span> },
        { label: "NETWORK", render: (i) => field(i, ["network_type"]) },
        { label: "METRIC", render: (i) => <strong>{field(i, ["metric_name"])}</strong> },
        { label: "OBSERVED", render: (i) => number(field(i, ["observed_value"])) },
        { label: "MESSAGE", render: (i) => <span className="wrap-cell">{field(i, ["message"])}</span> },
        { label: "STATUS", render: (i) => <span className={badgeClass(field(i, ["status"]))}>{field(i, ["status"], "OPEN")}</span> },
        { label: "ACTION", render: (i) => String(field(i, ["status"], "OPEN")).toUpperCase() === "RESOLVED" ? "—" : <button className="small-action" disabled={busyId === field(i, ["id", "alert_id"])} onClick={() => void resolve(i)}>{busyId === field(i, ["id", "alert_id"]) ? <LoaderCircle size={13} className="spin" /> : <CheckCircle2 size={13} />} Resolve</button> }
      ]} />
    </section>
  );

  const renderJobs = () => (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">AUTOMATION ORCHESTRATION</span><h2>Create Scheduled Job</h2><p>Uses the existing FastAPI job endpoint.</p></div>
          <span className="live-chip"><Cpu size={13} /> JOB ENGINE</span>
        </div>
        <form className="job-form" onSubmit={scheduleJob}>
          <label>Job name<input value={jobName} onChange={(e) => setJobName(e.target.value)} required /></label>
          <label>Job type<select value={jobType} onChange={(e) => setJobType(e.target.value as typeof jobType)}><option value="KPI_CHECK">KPI_CHECK</option><option value="KPI_REPORT">KPI_REPORT</option><option value="ANOMALY_SCAN">ANOMALY_SCAN</option></select></label>
          <label>Schedule time<input type="datetime-local" value={jobTime} onChange={(e) => setJobTime(e.target.value)} required /></label>
          <button className="primary-button" type="submit"><Zap size={15} /> Schedule job</button>
        </form>
        <p className="form-note"><CircleHelp size={14} /> Choose a future time. The browser sends an ISO-8601 timestamp to the API.</p>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">JOB HISTORY</span><h2>Automation Queue</h2></div><span className="counter">{jobs.length} records</span></div>
        <Table data={jobs} columns={[
          { label: "ID", render: (i) => field(i, ["id", "job_id"]) },
          { label: "NAME", render: (i) => <strong>{field(i, ["name"])}</strong> },
          { label: "TYPE", render: (i) => field(i, ["job_type"]) },
          { label: "STATUS", render: (i) => <span className={badgeClass(field(i, ["status"]))}>{field(i, ["status"], "UNKNOWN")}</span> },
          { label: "SCHEDULED", render: (i) => formatDate(field(i, ["scheduled_at"])) },
          { label: "CREATED", render: (i) => formatDate(field(i, ["created_at"])) },
          { label: "ACTIONS", render: (i) => {
            const status = String(field(i, ["status"], "")).toUpperCase();
            const id = field(i, ["id", "job_id"]);
            const retryable = ["FAILED", "QUEUED"].includes(status);
            return (
              <div className="action-row">
                <button className="small-action" disabled={busyId === id} onClick={() => void runJob(i, false)}><Play size={12} /> Execute</button>
                {retryable && <button className="small-action pink-action" disabled={busyId === id} onClick={() => void runJob(i, true)}><RotateCcw size={12} /> Retry</button>}
              </div>
            );
          } }
        ]} />
      </section>
    </div>
  );

  const renderThresholds = () => (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">RULES & GUARDRAILS</span><h2>KPI Thresholds</h2><p>Read-only view of configured threshold rules.</p></div><span className="counter">{thresholds.length} rules</span></div>
      <Table data={thresholds} columns={[
        { label: "ID", render: (i) => field(i, ["id"]) },
        { label: "NETWORK", render: (i) => <span className="network-tag">{field(i, ["network_type"])}</span> },
        { label: "METRIC", render: (i) => <strong>{field(i, ["metric_name"])}</strong> },
        { label: "WARNING BELOW", render: (i) => number(field(i, ["warning_below"])) },
        { label: "CRITICAL BELOW", render: (i) => number(field(i, ["critical_below"])) },
        { label: "WARNING ABOVE", render: (i) => number(field(i, ["warning_above"])) },
        { label: "CRITICAL ABOVE", render: (i) => number(field(i, ["critical_above"])) },
        { label: "ENABLED", render: (i) => String(field(i, ["enabled"], "—")) }
      ]} />
    </section>
  );

  const renderLicense = () => (
    <section className="panel license-panel">
      <div className="panel-heading"><div><span className="eyebrow">ENTITLEMENT & DEPLOYMENT</span><h2>License Overview</h2><p>Data from the current backend license endpoint.</p></div><ShieldCheck size={24} className="cyan-text" /></div>
      {license ? (
        <>
          <div className="license-banner">
            <div className="license-emblem"><ShieldCheck size={32} /></div>
            <div><span className="eyebrow">LICENSE RESPONSE</span><h3>{licenseText}</h3><p>Verify entitlement with your system administrator before commercial production use.</p></div>
            <span className={badgeClass(licenseText)}>{licenseText}</span>
          </div>
          <div className="license-fields">
            {Object.entries(license).map(([key, value]) => (
              <div className="license-field" key={key}><span>{key.replaceAll("_", " ")}</span><strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong></div>
            ))}
          </div>
        </>
      ) : <EmptyState text="Connect to the API to load license details." />}
      <div className="info-note"><LockKeyhole size={17} /><span>The backend currently reports its own entitlement mode. A response alone does not prove that a commercial production license has been activated.</span></div>
    </section>
  );

  const renderLogs = () => (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">SYSTEM TRACE</span><h2>Audit Logs</h2><p>Latest audit records returned by the backend.</p></div><span className="counter">{logs.length} records</span></div>
      <Table data={logs} columns={[
        { label: "ID", render: (i) => field(i, ["id"]) },
        { label: "ACTION", render: (i) => <strong>{field(i, ["action", "event_type", "event"])}</strong> },
        { label: "ENTITY", render: (i) => field(i, ["entity_type", "resource_type"]) },
        { label: "ENTITY ID", render: (i) => field(i, ["entity_id", "resource_id"]) },
        { label: "ACTOR", render: (i) => field(i, ["actor", "username", "user_id"]) },
        { label: "DETAILS", render: (i) => <span className="wrap-cell">{String(field(i, ["details", "message", "metadata"], "—"))}</span> },
        { label: "TIME", render: (i) => formatDate(field(i, ["created_at", "timestamp"])) }
      ]} />
    </section>
  );

  const content = {
    Overview: renderOverview,
    "Network KPIs": renderKpis,
    "Alerts Center": renderAlerts,
    "Automation Jobs": renderJobs,
    Thresholds: renderThresholds,
    License: renderLicense,
    "Audit Logs": renderLogs
  }[section]();

  return (
    <div className="app-shell">
      <div className="ambient ambient-cyan" />
      <div className="ambient ambient-pink" />
      <div className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Command size={23} /></div>
          <div className="brand-copy"><strong>APEXIVE<span>AI</span></strong><small>TELECOM SYSTEMS</small></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="workspace-label">WORKSPACE <span>01</span></div>
        <div className="tenant-card"><div className="tenant-avatar"><Network size={18} /></div><div><strong>Telecom RPA</strong><small>Control Center</small></div><ChevronRight size={15} /></div>
        <nav className="sidebar-nav">
          <span className="nav-heading">MONITORING</span>
          {navItems.slice(0, 3).map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileNav(false); }}>
              <Icon size={17} /><span>{label}</span>{label === "Alerts Center" && activeAlerts.length > 0 && <i className="nav-count">{activeAlerts.length}</i>}
            </button>
          ))}
          <span className="nav-heading">AUTOMATION</span>
          {navItems.slice(3, 5).map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={17} /><span>{label}</span></button>
          ))}
          <span className="nav-heading">ADMINISTRATION</span>
          {navItems.slice(5).map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={17} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="city-mini"><Globe2 size={17} /><div><strong>YANGON ↔ TOKYO</strong><small>Digital Operations</small></div><span className="pulse-dot" /></div>
          <div className="sidebar-version"><span>APEXIVE RPA</span><span>v1.0.0 UI</span></div>
        </div>
      </div>

      {mobileNav && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div className="breadcrumb"><span>APEXIVE AI</span><ChevronRight size={13} /><strong>{section.toUpperCase()}</strong></div>
          </div>
          <div className="topbar-right">
            <div className={`connection-state ${health}`}><span className="pulse-dot" />{health === "online" ? "API ONLINE" : health === "offline" ? "API OFFLINE" : "CONNECTING"}</div>
            <button className="icon-button" onClick={refresh} title="Refresh dashboard" aria-label="Refresh dashboard"><RefreshCw size={16} className={loading ? "spin" : ""} /></button>
            <div className="user-chip"><div className="user-avatar">AX</div><div><strong>System Admin</strong><small>Operations</small></div></div>
          </div>
        </header>

        <div className="page-content">
          <section className="hero">
            <div className="hero-grid" />
            <div className="hero-copy">
              <div className="hero-kicker"><span className="kicker-line" /> INTELLIGENT NETWORK OPERATIONS <span className="hero-version">SYSTEM 01 / 26</span></div>
              <h1>TELECOM <span>RPA</span><br />CONTROL CENTER<span className="title-period">.</span></h1>
              <p>Observe the network. Detect anomalies. Orchestrate automation.</p>
              <div className="hero-meta"><span><i className="legend-dot cyan-dot" /> Network intelligence</span><span><i className="legend-dot pink-dot" /> Automated operations</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" />
              <div className="hero-core"><RadioTower size={33} /><span>AX</span></div>
              <div className="hero-coordinate">35° 40′ N<br />139° 41′ E</div>
              <div className="hero-scan" />
            </div>
            <div className="hero-bottom"><span><span className="pulse-dot" /> SYSTEM TELEMETRY</span><span>YANGON OPERATIONS / TOKYO INTERFACE</span><span>SECURE API SESSION</span></div>
          </section>

          <div className="section-heading">
            <div><span className="eyebrow">OPERATIONS OVERVIEW</span><h2>{section}</h2></div>
            <div className="section-actions">
              {lastUpdated && <span className="updated-label"><Clock3 size={13} /> Updated {lastUpdated.toLocaleTimeString()}</span>}
              <button className="secondary-button" onClick={refresh}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh</button>
            </div>
          </div>

          {error && <div className="message-banner error-banner"><AlertTriangle size={16} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
          {notice && <div className="message-banner success-banner"><CheckCircle2 size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={15} /></button></div>}

          {!token && (
            <section className="connect-panel panel">
              <div className="connect-icon"><LockKeyhole size={23} /></div>
              <div className="connect-copy"><h3>Connect to Telecom RPA API</h3><p>Enter the API token configured in your FastAPI backend to load protected network data.</p></div>
              <form className="token-form" onSubmit={connect}>
                <input type="password" autoComplete="off" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Enter API token" aria-label="API token" />
                <button className="primary-button" type="submit"><Wifi size={15} /> Connect</button>
              </form>
            </section>
          )}

          {loading && <div className="loading-strip"><LoaderCircle size={15} className="spin" /> Syncing dashboard endpoints…</div>}
          <div className="section-content">{content}</div>

          <footer className="footer">
            <div><span className="footer-logo">APEXIVE<span>AI</span></span><span>Telecom RPA · Intelligent Operations</span></div>
            <div><span className="footer-api"><span className={`pulse-dot ${health === "offline" ? "pulse-off" : ""}`} /> {health === "online" ? "API REACHABLE" : health === "offline" ? "API UNREACHABLE" : "CHECKING API"}</span><span>© 2026 ApexiveAI</span></div>
          </footer>
        </div>
      </main>
    </div>
  );
}
