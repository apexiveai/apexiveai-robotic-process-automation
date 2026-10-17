import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, Bot, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Command, Cpu,
  Database, Download, FileSpreadsheet, Gauge, Globe2,
  LayoutDashboard, LoaderCircle, LockKeyhole, Menu, Network,
  MapPin, Play, RadioTower, RefreshCw, RotateCcw, Search, Send, Server, ShieldCheck,
  Signal, TerminalSquare, Users, Wifi, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import {
  createJob, downloadHourlyReport, executeJob, getAlerts, getAuditLogs,
  getHourlyReport,
  getHealth, getJobs, getKpis, getLicense, getThresholds,
  resolveAlert, retryJob, submitKpi, type HourlyReport,
  type HourlyReportItem
} from "./api";

type Item = Record<string, unknown>;
type NodeStatus = "ONLINE" | "DEGRADED" | "CRITICAL" | "OFFLINE";
type NetworkNode = {
  id: string;
  type: string;
  region: string;
  status: NodeStatus;
  cpu: number;
  memory: number;
  traffic: number;
  sessions: number;
  latency: number;
  packetLoss: number;
  lastCheck: string;
};
type Section =
  | "Overview"
  | "Network Topology"
  | "Geographic Map"
  | "Network KPIs"
  | "Hourly Reports"
  | "Historical KPI Timeline"
  | "Alerts Center"
  | "Service Health"
  | "Network Dependency Map"
  | "Automation Jobs"
  | "Workflow Monitor"
  | "RPA Execution History"
  | "Thresholds"
  | "Performance Analytics"
  | "Traffic Analytics"
  | "AI Predictions"
  | "API / Integration"
  | "System Settings"
  | "License"
  | "Audit Logs";

const navItems: {
  label: Section;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Network KPIs", icon: Signal },
  { label: "Network Topology", icon: Network },
  { label: "Geographic Map", icon: Globe2 },
  { label: "Hourly Reports", icon: FileSpreadsheet },
  { label: "Historical KPI Timeline", icon: Activity },
  { label: "Alerts Center", icon: Bell },
  { label: "Service Health", icon: CheckCircle2 },
  { label: "Network Dependency Map", icon: Network },
  { label: "Automation Jobs", icon: Bot },
  { label: "Workflow Monitor", icon: Activity },
  { label: "RPA Execution History", icon: Clock3 },
  { label: "Thresholds", icon: Gauge },
  { label: "Performance Analytics", icon: Activity },
  { label: "Traffic Analytics", icon: Activity },
  { label: "AI Predictions", icon: Zap },
  { label: "API / Integration", icon: Database },
  { label: "System Settings", icon: ShieldCheck },
  { label: "License", icon: ShieldCheck },
  { label: "Audit Logs", icon: TerminalSquare }
];

const navGroups: { heading: string; sections: Section[] }[] = [
  { heading: "MONITORING", sections: ["Overview", "Network KPIs", "Network Topology", "Geographic Map", "Hourly Reports", "Historical KPI Timeline", "Alerts Center", "Service Health", "Network Dependency Map"] },
  { heading: "AUTOMATION", sections: ["Automation Jobs", "Workflow Monitor", "RPA Execution History", "Thresholds"] },
  { heading: "ANALYTICS", sections: ["Performance Analytics", "Traffic Analytics", "AI Predictions"] },
  { heading: "ADMINISTRATION", sections: ["API / Integration", "License", "Audit Logs", "System Settings"] }
];

const geographicRegions = [
  { name: "Mandalay", status: "ONLINE" as NodeStatus, x: 61, y: 28, cells: 18, availability: "99.8%", traffic: "4.62 TB", cellIds: [{ id: "MDY-001", status: "ONLINE" as NodeStatus }, { id: "MDY-002", status: "ONLINE" as NodeStatus }, { id: "MDY-003", status: "ONLINE" as NodeStatus }] },
  { name: "Naypyidaw", status: "ONLINE" as NodeStatus, x: 49, y: 51, cells: 12, availability: "99.7%", traffic: "2.18 TB", cellIds: [{ id: "NPT-001", status: "ONLINE" as NodeStatus }, { id: "NPT-002", status: "DEGRADED" as NodeStatus }] },
  { name: "Yangon", status: "CRITICAL" as NodeStatus, x: 40, y: 73, cells: 46, availability: "98.1%", traffic: "8.72 TB", cellIds: [{ id: "AHLONE-001", status: "ONLINE" as NodeStatus }, { id: "AHLONE-002", status: "ONLINE" as NodeStatus }, { id: "AHLONE-003", status: "CRITICAL" as NodeStatus }] },
  { name: "Dawei", status: "DEGRADED" as NodeStatus, x: 57, y: 91, cells: 9, availability: "97.4%", traffic: "1.06 TB", cellIds: [{ id: "DWI-001", status: "DEGRADED" as NodeStatus }, { id: "DWI-002", status: "ONLINE" as NodeStatus }] }
];

const historyMetrics = ["Availability", "Traffic", "CSSR", "DCR", "VoLTE", "Latency"] as const;
type HistoryMetric = typeof historyMetrics[number];

const nodeRegions = ["Yangon", "Mandalay", "Naypyidaw", "Bago", "Mawlamyine"];
const nodeTypes = ["BTS", "NodeB", "eNB", "gNodeB", "MSC", "HLR/HSS", "SGSN", "SGW", "PGW", "IMS"];
const nodeStatuses: NodeStatus[] = ["ONLINE", "ONLINE", "ONLINE", "DEGRADED", "ONLINE", "CRITICAL", "OFFLINE"];

function createNetworkNodes(): NetworkNode[] {
  const nodes: NetworkNode[] = [{
    id: "MPT-CORE-04",
    type: "PGW",
    region: "Yangon",
    status: "ONLINE",
    cpu: 42,
    memory: 61,
    traffic: 1.82,
    sessions: 84291,
    latency: 18,
    packetLoss: 0.2,
    lastCheck: ""
  }];

  for (let index = 1; index < 100; index += 1) {
    const type = nodeTypes[(index - 1) % nodeTypes.length];
    const status = nodeStatuses[(index * 3) % nodeStatuses.length];
    nodes.push({
      id: `MPT-${type === "BTS" || type === "NodeB" || type === "eNB" || type === "gNodeB" ? "RAN" : "CORE"}-${String(index + 1).padStart(2, "0")}`,
      type,
      region: nodeRegions[index % nodeRegions.length],
      status,
      cpu: 24 + ((index * 17) % 67),
      memory: 32 + ((index * 13) % 62),
      traffic: Number((0.4 + ((index * 29) % 220) / 100).toFixed(2)),
      sessions: 12500 + ((index * 7919) % 96000),
      latency: 9 + ((index * 7) % 45),
      packetLoss: Number((((index * 11) % 17) / 100).toFixed(2)),
      lastCheck: ""
    });
  }

  return nodes;
}

const demoNetworkNodes = createNetworkNodes();

const topologyNodes = [
  { id: "MPT-RAN-2G-01", type: "BTS", label: "2G · BTS", region: "Yangon" },
  { id: "MPT-RAN-3G-01", type: "NodeB", label: "3G · NodeB", region: "Yangon" },
  { id: "MPT-RAN-4G-01", type: "eNB", label: "4G · eNodeB", region: "Yangon" },
  { id: "MPT-RAN-5G-01", type: "gNodeB", label: "5G · gNodeB", region: "Yangon" },
  { id: "MPT-CORE-CS-01", type: "MSC", label: "CS · MSC", region: "Yangon" },
  { id: "MPT-CORE-HSS-01", type: "HLR/HSS", label: "HLR / HSS", region: "Yangon" },
  { id: "MPT-CORE-SGSN-01", type: "SGSN", label: "PS · SGSN", region: "Yangon" },
  { id: "MPT-CORE-SGW-01", type: "SGW", label: "4G · SGW", region: "Yangon" },
  { id: "MPT-CORE-04", type: "PGW", label: "4G · PGW", region: "Yangon" },
  { id: "MPT-CORE-IMS-01", type: "IMS", label: "VoLTE · IMS", region: "Yangon" }
];

const cellSites = [
  {
    region: "AHLONE",
    btsId: "MPT-BTS-AHLONE-01",
    enodebId: "MPT-ENB-YGN-01",
    cells: [
      { id: "AHLONE-001", status: "ONLINE" as NodeStatus },
      { id: "AHLONE-002", status: "ONLINE" as NodeStatus },
      { id: "AHLONE-003", status: "CRITICAL" as NodeStatus }
    ]
  },
  {
    region: "NayPyiTaw",
    btsId: "MPT-BTS-NPT-01",
    enodebId: "MPT-ENB-NPT-01",
    cells: [
      { id: "NPT-001", status: "ONLINE" as NodeStatus },
      { id: "NPT-002", status: "DEGRADED" as NodeStatus }
    ]
  },
  {
    region: "HANTHARWATI",
    btsId: "MPT-BTS-HTWT-01",
    enodebId: "MPT-ENB-HTWT-01",
    cells: [
      { id: "HTWT-001", status: "ONLINE" as NodeStatus }
    ]
  }
];

function nodeStatusClass(status: NodeStatus) {
  return `node-status ${status.toLowerCase()}`;
}

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

function field(
  item: Item,
  keys: string[],
  fallback: string | number = "—"
): string | number {
  for (const key of keys) {
    const value = item[key];
    if (
      typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
    ) {
      return typeof value === "boolean" ? String(value) : value;
    }
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
  const [selectedNodeId, setSelectedNodeId] = useState("MPT-CORE-04");
  const [selectedCell, setSelectedCell] = useState("AHLONE-001");
  const [alarmDetailsOpen, setAlarmDetailsOpen] = useState(false);
  const [automationWorkflowOpen, setAutomationWorkflowOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("Yangon");
  const [selectedMapCell, setSelectedMapCell] = useState("AHLONE-001");
  const [dependencyTarget, setDependencyTarget] = useState<"PGW-01" | "IMS-02">("PGW-01");
  const [timelineMetric, setTimelineMetric] = useState<HistoryMetric>("Availability");
  const [topologyPage, setTopologyPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [topologyUpdatedAt, setTopologyUpdatedAt] = useState(() => new Date());
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
  const [hourlyReport, setHourlyReport] = useState<HourlyReport | null>(null);
  const [reportNetwork, setReportNetwork] = useState<"all" | "PS" | "CS" | "VoLTE">("all");
  const [reportHours, setReportHours] = useState(24);
  const [reportMetric, setReportMetric] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [reportUpdated, setReportUpdated] = useState<Date | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [jobName, setJobName] = useState("Scheduled KPI Health Check");
  const [jobType, setJobType] = useState<"KPI_REPORT" | "KPI_CHECK" | "ANOMALY_SCAN">("KPI_CHECK");
  const [jobTime, setJobTime] = useState("");
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiNetwork, setKpiNetwork] = useState<"PS" | "CS" | "VoLTE">("VoLTE");
  const [metricName, setMetricName] = useState("availability");
  const [metricValue, setMetricValue] = useState("98.5");
  const [metricUnit, setMetricUnit] = useState("%");

  useEffect(() => {
    const interval = window.setInterval(() => setTopologyUpdatedAt(new Date()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

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
        setter: (value: unknown) => void,
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

  const loadHourlyReport = useCallback(async (activeToken: string) => {
    setReportLoading(true);
    try {
      const result = await getHourlyReport(
        activeToken,
        reportHours,
        reportNetwork === "all" ? undefined : reportNetwork
      );
      setHourlyReport(result);
      setReportUpdated(new Date());
      setHealth("online");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load hourly report.");
    } finally {
      setReportLoading(false);
    }
  }, [reportHours, reportNetwork]);

  useEffect(() => {
    if (!token || !["Hourly Reports", "Historical KPI Timeline", "Performance Analytics", "Traffic Analytics"].includes(section)) return;
    const initialLoad = window.setTimeout(() => {
      void loadHourlyReport(token);
    }, 0);
    const interval = window.setInterval(() => {
      void loadHourlyReport(token);
    }, 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [token, section, loadHourlyReport]);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then(() => { if (!cancelled) setHealth("online"); })
      .catch(() => { if (!cancelled) setHealth("offline"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return;
    const initialLoad = window.setTimeout(() => {
      void loadData(token);
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [token, loadData]);

  const refresh = () => {
    if (!token.trim()) {
      setError("Enter your API token to load protected dashboard data.");
      return;
    }
    void loadData(token);
    if (section === "Hourly Reports") void loadHourlyReport(token);
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

  const reportMetrics = useMemo(
    () => [...new Set(hourlyReport?.items.map((item) => item.metric_name) ?? [])].sort(),
    [hourlyReport]
  );
  const selectedReportMetric = reportMetrics.includes(reportMetric)
    ? reportMetric
    : reportMetrics[0] ?? "";
  const reportChartData = useMemo(() => {
    const data = new Map<string, Item>();
    for (const item of hourlyReport?.items ?? []) {
      if (item.metric_name !== selectedReportMetric) continue;
      const hour = item.hour;
      const bucket = data.get(hour) ?? { hour };
      bucket[item.network_type] = item.average;
      data.set(hour, bucket);
    }
    return [...data.values()].sort(
      (a, b) => new Date(String(a.hour)).getTime() - new Date(String(b.hour)).getTime()
    );
  }, [hourlyReport, selectedReportMetric]);
  const latestByNetwork = useMemo(() => {
    const latest: Partial<Record<"PS" | "CS" | "VoLTE", HourlyReportItem>> = {};
    for (const item of hourlyReport?.items ?? []) {
      const current = latest[item.network_type];
      if (
        item.metric_name === selectedReportMetric
        && (!current || new Date(item.hour).getTime() > new Date(current.hour).getTime())
      ) {
        latest[item.network_type] = item;
      }
    }
    return latest;
  }, [hourlyReport, selectedReportMetric]);

  const selectedNode = demoNetworkNodes.find((node) => node.id === selectedNodeId) ?? demoNetworkNodes[0];
  const selectedPageNode = demoNetworkNodes[topologyPage - 1] ?? demoNetworkNodes[0];

  const selectTopologyNode = (node: NetworkNode) => {
    setSelectedNodeId(node.id);
    const page = demoNetworkNodes.findIndex((item) => item.id === node.id) + 1;
    if (page > 0) {
      setTopologyPage(page);
      setPageInput(String(page));
    }
  };

  const goToTopologyPage = (page: number) => {
    const safePage = Math.min(100, Math.max(1, page));
    const node = demoNetworkNodes[safePage - 1];
    setTopologyPage(safePage);
    setPageInput(String(safePage));
    setSelectedNodeId(node.id);
  };

  const submitTopologyPage = (event: React.FormEvent) => {
    event.preventDefault();
    const page = Number(pageInput);
    if (!Number.isInteger(page) || page < 1 || page > 100) {
      setError("Choose a node page from 1 to 100.");
      return;
    }
    setError("");
    goToTopologyPage(page);
  };

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

  const exportHourlyReport = async () => {
    if (!token) {
      setError("Connect with an API token before exporting reports.");
      return;
    }
    setReportDownloading(true);
    try {
      const blob = await downloadHourlyReport(
        token,
        reportHours,
        reportNetwork === "all" ? undefined : reportNetwork
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "telecom-hourly-report.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Excel workbook downloaded with raw data, hourly summary and trend chart.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download Excel report.");
    } finally {
      setReportDownloading(false);
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

  const renderTopology = () => {
    const statusCounts = demoNetworkNodes.reduce<Record<NodeStatus, number>>((counts, node) => {
      counts[node.status] += 1;
      return counts;
    }, { ONLINE: 0, DEGRADED: 0, CRITICAL: 0, OFFLINE: 0 });
    const allCells = cellSites.flatMap((site) => site.cells.map((cell) => ({ site, cell })));
    const selectedCellInfo = allCells.find(({ cell }) => cell.id === selectedCell) ?? allCells[0];
    const cellIndex = allCells.findIndex(({ cell }) => cell.id === selectedCell);
    const activeUsers = 820 + Math.max(0, cellIndex) * 173;
    const cellStatus = selectedCellInfo.cell.status;
    const trafficStages = [
      { label: "BTS", type: "BTS" },
      { label: "eNodeB", type: "eNB", rate: "820 Mbps" },
      { label: "SGW", type: "SGW", rate: "1.4 Gbps" },
      { label: "PGW", type: "PGW", rate: "1.2 Gbps" },
      { label: "INTERNET", rate: "UPLINK" }
    ];
    const automationJobs = [
      { name: "Hourly KPI Collection", status: "RUNNING" },
      { name: "Traffic Report", status: "COMPLETED" },
      { name: "Threshold Monitoring", status: "RUNNING" },
      { name: "Alarm Detection", status: "RUNNING" },
      { name: "Daily Report Generation", status: "SCHEDULED" },
      { name: "Incident Analysis", status: "2 QUEUED" }
    ];
    const redNodeWorkflow = [
      { title: "Detect abnormal KPI", detail: "Cell availability is 91.4%, below the 95% threshold." },
      { title: "Collect related KPIs", detail: "Gather availability, traffic, drop rate, and radio quality." },
      { title: "Compare threshold", detail: "Confirm the critical availability breach against the configured limit." },
      { title: "Identify affected cells", detail: "Trace the alarm from AHLONE-003 through eNodeB-07." },
      { title: "Generate incident", detail: "Create incident MPT-20261017-0842 with critical severity." },
      { title: "Notify operation team", detail: "Prepare an engineer notification for the affected region." },
      { title: "Generate report", detail: "Compile the alarm evidence and recovery workflow summary." }
    ];
    const coreHealthMetrics = [
      { label: "NETWORK HEALTH", value: "98.7%", detail: "Overall service availability", icon: Activity, tone: "cyan" },
      { label: "RAN AVAILABILITY", value: "99.2%", detail: "Radio access network", icon: RadioTower, tone: "blue" },
      { label: "CORE HEALTH", value: "99.8%", detail: "Core nodes operational", icon: Server, tone: "purple" },
      { label: "VoLTE SUCCESS", value: "97.6%", detail: "Call setup success", icon: Signal, tone: "cyan" },
      { label: "DATA TRAFFIC", value: "18.42 TB", detail: "Aggregate traffic volume", icon: Database, tone: "blue" },
      { label: "ACTIVE USERS", value: "2.84 M", detail: "Current subscriber sessions", icon: Users, tone: "purple" },
      { label: "ACTIVE ALARMS", value: "07", detail: "Across monitored network", icon: Bell, tone: "pink" }
    ];

    return (
      <div className="topology-page">
        <div className="stats-grid topology-stats">
          <StatCard label="NODES MONITORED" value="100" detail="Demo inventory · Yangon region" icon={Network} tone="cyan" />
          <StatCard label="ONLINE" value={number(statusCounts.ONLINE, 0)} detail="Reporting normally" icon={CheckCircle2} tone="cyan" />
          <StatCard label="NEEDS ATTENTION" value={number(statusCounts.DEGRADED + statusCounts.CRITICAL, 0)} detail={`${statusCounts.DEGRADED} degraded · ${statusCounts.CRITICAL} critical`} icon={AlertTriangle} tone="pink" />
          <StatCard label="OFFLINE" value={number(statusCounts.OFFLINE, 0)} detail="Demo status simulation" icon={Server} tone="purple" />
        </div>

        <div className="topology-layout">
          <section className="panel topology-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">MPT NETWORK · LIVE TOPOLOGY</span>
                <h2>Radio Access & Core Network</h2>
                <p>Choose a node to inspect its health and traffic telemetry.</p>
              </div>
              <div className="topology-heading-actions">
                <button className="alarm-topology-badge" onClick={() => setAlarmDetailsOpen(true)}><AlertTriangle size={12} /> CRITICAL · AHLONE-003</button>
                <span className="live-chip"><span className="pulse-dot" /> DEMO FEED</span>
              </div>
            </div>

            <div className="topology-canvas" aria-label="Interactive MPT network topology">
              <div className="topology-root">
                <RadioTower size={17} />
                <span>MPT NETWORK</span>
                <small>YANGON NOC</small>
              </div>
              <svg className="topology-routes" viewBox="0 0 1000 390" preserveAspectRatio="none" aria-hidden="true">
                <path d="M500 76 V106 M500 106 H255 V132 M500 106 H755 V132" />
                <path className="route-accent" d="M500 76 V106 H755 V132" />
              </svg>
              <div className="topology-branches">
                <section className="topology-domain ran-domain">
                  <div className="domain-heading"><span>01</span><div><strong>RAN / BTS</strong><small>RADIO ACCESS</small></div></div>
                  <div className="topology-node-list">
                    {topologyNodes.slice(0, 4).map((item) => {
                      const node = demoNetworkNodes.find((record) => record.type === item.type) ?? selectedNode;
                      return (
                        <button key={item.id} className={`topology-node ${selectedNode.id === node.id ? "selected" : ""}`} onClick={() => selectTopologyNode(node)}>
                          <span className={`node-indicator ${node.status.toLowerCase()}`} />
                          <strong>{item.label}</strong>
                          <small>{node.id}</small>
                          <span className={nodeStatusClass(node.status)}>{node.status}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="topology-domain core-domain">
                  <div className="domain-heading"><span>02</span><div><strong>CORE NETWORK</strong><small>CS · PS · IMS / VOLTE</small></div></div>
                  <div className="core-topology-groups">
                    {[
                      topologyNodes.slice(4, 6),
                      topologyNodes.slice(6, 9),
                      topologyNodes.slice(9, 10)
                    ].map((group, groupIndex) => (
                      <div className="core-topology-row" key={groupIndex}>
                        {group.map((item) => {
                          const node = demoNetworkNodes.find((record) => record.type === item.type) ?? selectedNode;
                          return (
                            <button key={item.id} className={`topology-node ${selectedNode.id === node.id ? "selected" : ""}`} onClick={() => selectTopologyNode(node)}>
                              <span className={`node-indicator ${node.status.toLowerCase()}`} />
                              <strong>{item.label}</strong>
                              <small>{node.id}</small>
                              <span className={nodeStatusClass(node.status)}>{node.status}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="topology-internet"><Globe2 size={15} /> EXTERNAL SERVICES / INTERNET</div>
                </section>
              </div>
            </div>

            <div className="traffic-flow-panel">
              <div className="traffic-flow-heading"><span className="eyebrow">REAL-TIME TRAFFIC FLOW</span><span className="live-chip"><span className="pulse-dot" /> FLOW SIMULATION</span></div>
              <div className="traffic-flow" aria-label="Animated traffic flow from BTS to Internet">
                {trafficStages.map((stage, index) => {
                  const node = stage.type
                    ? demoNetworkNodes.find((record) => record.type === stage.type)
                    : undefined;
                  const stageContent = (
                    <>
                      <span className={`traffic-node-icon ${stage.type === "BTS" || stage.type === "eNB" ? "access" : "core"}`}>{stage.type === "INTERNET" ? <Globe2 size={16} /> : <Server size={16} />}</span>
                      <strong>{stage.label}</strong>
                    </>
                  );
                  return (
                    <div className="traffic-flow-segment" key={stage.label}>
                      {index > 0 && <div className="traffic-link"><span>{stage.rate}</span><i><b /></i></div>}
                      {node ? (
                        <button className={`traffic-node ${selectedNode.id === node.id ? "selected" : ""}`} onClick={() => selectTopologyNode(node)} aria-label={`Select ${stage.label} node ${node.id}`}>
                          {stageContent}
                        </button>
                      ) : <div className="traffic-node external">{stageContent}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="topology-legend" aria-label="Node status legend">
              {(["ONLINE", "DEGRADED", "CRITICAL", "OFFLINE"] as NodeStatus[]).map((status) => (
                <span key={status}><i className={`node-indicator ${status.toLowerCase()}`} />{status}</span>
              ))}
              <span className="topology-refresh-time"><Clock3 size={12} /> Refreshed {topologyUpdatedAt.toLocaleTimeString()}</span>
            </div>
          </section>

          <aside className="panel node-details">
            <div className="panel-heading">
              <div><span className="eyebrow">SELECTED DEVICE</span><h2>Node Details</h2></div>
              <span className={`node-indicator large ${selectedNode.status.toLowerCase()}`} />
            </div>
            <div className="node-identity"><span className="node-type-icon"><Server size={21} /></span><div><strong>{selectedNode.id}</strong><small>{selectedNode.type} · MPT Network</small></div></div>
            <div className="node-meta-grid">
              <div><span>REGION</span><strong><MapPin size={12} />{selectedNode.region}</strong></div>
              <div><span>STATUS</span><strong className={`detail-status ${selectedNode.status.toLowerCase()}`}>{selectedNode.status}</strong></div>
            </div>
            <div className="detail-metric-list">
              <div><span>CPU</span><strong>{selectedNode.cpu}%</strong><i><b style={{ width: `${selectedNode.cpu}%` }} /></i></div>
              <div><span>Memory</span><strong>{selectedNode.memory}%</strong><i><b style={{ width: `${selectedNode.memory}%` }} /></i></div>
              <div><span>Traffic</span><strong>{selectedNode.traffic.toFixed(2)} Gbps</strong></div>
              <div><span>Sessions</span><strong>{selectedNode.sessions.toLocaleString()}</strong></div>
              <div><span>Latency</span><strong>{selectedNode.latency} ms</strong></div>
              <div><span>Packet loss</span><strong>{selectedNode.packetLoss.toFixed(2)}%</strong></div>
            </div>
            <div className="node-last-check"><Clock3 size={13} /> Last check <strong>{topologyUpdatedAt.toLocaleTimeString()}</strong></div>
            <p className="demo-data-note">Sample telemetry for UI validation. Connect an MPT/NMS collector before using operationally.</p>
          </aside>
        </div>

        <section className="panel cell-monitor-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BTS → CELL → CORE</span><h2>Yangon Cell Monitoring</h2><p>Select a cell to inspect the cell-level KPI snapshot.</p></div>
            <span className="counter">3 sites · 6 cells</span>
          </div>
          <div className="cell-drill-path" aria-label="Selected cell network path">
            <span className="drill-root">YANGON</span>
            <ChevronRight size={13} />
            <span className="drill-site">{selectedCellInfo.site.region}</span>
            <ChevronRight size={13} />
            <button onClick={() => {
              const node = demoNetworkNodes.find((record) => record.type === "BTS");
              if (node) selectTopologyNode(node);
            }}>BTS <small>{selectedCellInfo.site.btsId}</small></button>
            <ChevronRight size={13} />
            <span className={`drill-current ${cellStatus.toLowerCase()}`}><i className={`node-indicator ${cellStatus.toLowerCase()}`} />{selectedCellInfo.cell.id}</span>
            <ChevronRight size={13} />
            <button onClick={() => {
              const node = demoNetworkNodes.find((record) => record.type === "eNB");
              if (node) selectTopologyNode(node);
            }}>eNodeB <small>{selectedCellInfo.site.enodebId}</small></button>
            <ChevronRight size={13} />
            <button onClick={() => {
              const node = demoNetworkNodes.find((record) => record.type === "PGW");
              if (node) selectTopologyNode(node);
            }}>CORE <small>PGW · MPT-CORE-04</small></button>
          </div>
          <div className="cell-monitor-layout">
            <div className="cell-site-list">
              {cellSites.map((site) => (
                <div className="cell-site" key={site.region}>
                  <strong><MapPin size={13} />{site.region}</strong>
                  <div>{site.cells.map((cell) => {
                    return <button key={cell.id} className={`cell-chip ${selectedCell === cell.id ? "selected" : ""}`} onClick={() => {
                      setSelectedCell(cell.id);
                      if (cell.status === "CRITICAL") setAlarmDetailsOpen(true);
                    }}><i className={`node-indicator ${cell.status.toLowerCase()}`} />{cell.id}{cell.status === "CRITICAL" && <span className="cell-alarm-label">ALARM</span>}</button>;
                  })}</div>
                </div>
              ))}
            </div>
            <div className="cell-kpis">
              <div className="cell-kpi-heading"><span>SELECTED CELL · {selectedCellInfo.site.region}</span><strong><i className={`node-indicator ${cellStatus.toLowerCase()}`} />{selectedCellInfo.cell.id}</strong></div>
              {[
                ["Active users", activeUsers.toLocaleString()],
                ["Traffic", `${(0.18 + Math.max(0, cellIndex) * 0.07).toFixed(2)} Gbps`],
                ["Throughput", `${48 + Math.max(0, cellIndex) * 6} Mbps`],
                ["RSRP / RSRQ", "−91 dBm / −10 dB"],
                ["SINR", "18 dB"],
                ["Drop / Call setup", "0.4% / 98.7%"],
                ["Handover / Availability", "97.9% / 99.96%"]
              ].map(([label, value]) => <div className="cell-kpi" key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </div>
        </section>

        <section className={`panel alarm-overlay-panel ${alarmDetailsOpen ? "expanded" : ""}`} id="active-mpt-alarm">
          <div className="panel-heading">
            <div><span className="eyebrow">ALARM / INCIDENT OVERLAY</span><h2>Active Network Incident</h2><p>Critical cell alarm impact path and automated response status.</p></div>
            <span className="status-pill danger">1 ACTIVE CRITICAL</span>
          </div>
          <button className="alarm-summary-button" onClick={() => {
            setSelectedCell("AHLONE-003");
            setAlarmDetailsOpen((open) => !open);
          }} aria-expanded={alarmDetailsOpen}>
            <span className="alarm-summary-icon"><AlertTriangle size={18} /></span>
            <span className="alarm-summary-copy"><strong>CRITICAL · AHLONE-003</strong><small>Cell Availability below threshold · MPT-20261017-0842</small></span>
            <span className="alarm-summary-action">{alarmDetailsOpen ? "Hide details" : "View alarm"}<ChevronRight size={14} /></span>
          </button>
          <div className="alarm-impact-path" aria-label="Alarm impact path from cell to core gateways">
            <div className="alarm-path-node alarm-path-cell">
              <span className="alarm-path-severity"><i className="node-indicator critical" /> CRITICAL</span>
              <strong>AHLONE-003</strong><small>Cell · Availability 91.4%</small>
            </div>
            <span className="alarm-path-link"><i /></span>
            <button className="alarm-path-node" onClick={() => {
              const node = demoNetworkNodes.find((record) => record.type === "eNB");
              if (node) selectTopologyNode(node);
            }}><strong>eNodeB-07</strong><small>Radio access node</small></button>
            <span className="alarm-path-split"><i /><i /></span>
            <div className="alarm-path-gateways">
              {["PGW-01", "PGW-02"].map((gateway, index) => (
                <button className="alarm-path-node alarm-gateway" key={gateway} onClick={() => {
                  const gateways = demoNetworkNodes.filter((record) => record.type === "PGW");
                  const node = gateways[index] ?? gateways[0];
                  if (node) selectTopologyNode(node);
                }}><strong>{gateway}</strong><small><i className="node-indicator online" /> ONLINE</small></button>
              ))}
            </div>
          </div>
          {alarmDetailsOpen && (
            <div className="alarm-details">
              <div className="alarm-facts">
                {[
                  ["ALARM ID", "MPT-20261017-0842"],
                  ["SEVERITY", "CRITICAL"],
                  ["NODE", "AHLONE-003"],
                  ["KPI", "Cell Availability"],
                  ["CURRENT", "91.4%"],
                  ["THRESHOLD", "95%"],
                  ["STARTED", "16:02"],
                  ["DURATION", "07m 42s"]
                ].map(([label, value]) => <div className="alarm-fact" key={label}><span>{label}</span><strong className={label === "SEVERITY" ? "critical-text" : ""}>{value}</strong></div>)}
              </div>
              <div className="alarm-auto-actions">
                <span className="eyebrow">AUTO ACTION · DEMO STATUS</span>
                <div><CheckCircle2 size={14} /> Incident created</div>
                <div><CheckCircle2 size={14} /> Engineer notified</div>
                <div><CheckCircle2 size={14} /> RPA diagnostic started</div>
              </div>
              <p className="alarm-demo-note">Illustrative incident data only. No engineer notification or diagnostic job has been executed by this demo UI.</p>
            </div>
          )}
        </section>

        <section className="panel automation-engine-panel" id="rpa-automation-engine">
          <div className="panel-heading">
            <div><span className="eyebrow">5 · RPA AUTOMATION STATUS</span><h2>Automation Engine</h2><p>Operational workflow status linked to the active network incident.</p></div>
            <span className="live-chip"><Bot size={13} /> DEMO ENGINE</span>
          </div>
          <div className="automation-status-grid">
            {automationJobs.map((job) => (
              <div className="automation-status-row" key={job.name}>
                <span className={`automation-status-icon ${job.status === "COMPLETED" ? "done" : job.status === "2 QUEUED" ? "queued" : "active"}`}>
                  {job.status === "COMPLETED" ? <CheckCircle2 size={14} /> : job.status === "2 QUEUED" ? <Clock3 size={14} /> : <Activity size={14} />}
                </span>
                <strong>{job.name}</strong>
                <span className={`automation-state ${job.status === "COMPLETED" ? "done" : job.status === "2 QUEUED" ? "queued" : "active"}`}>{job.status}</span>
              </div>
            ))}
          </div>
          <div className="automation-explain">
            <div className="automation-explain-copy">
              <span className="eyebrow">INCIDENT DIAGNOSTICS</span>
              <strong>Why is this node RED?</strong>
              <small>Inspect the simulated RPA reasoning for AHLONE-003.</small>
            </div>
            <button className="small-action" onClick={() => setAutomationWorkflowOpen((open) => !open)} aria-expanded={automationWorkflowOpen}>
              {automationWorkflowOpen ? "Hide workflow" : "Show workflow"} <ChevronRight size={13} />
            </button>
          </div>
          {automationWorkflowOpen && (
            <div className="automation-workflow">
              <div className="workflow-heading"><span>ALARM MPT-20261017-0842 · AHLONE-003</span><span className="live-chip">SIMULATED TRACE</span></div>
              <div className="workflow-steps">
                {redNodeWorkflow.map((step, index) => (
                  <div className="workflow-step" key={step.title}>
                    <span className="workflow-step-number">{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{step.title}</strong><small>{step.detail}</small></div>
                    <CheckCircle2 size={14} />
                  </div>
                ))}
              </div>
              <p className="workflow-demo-note">Workflow steps illustrate the intended RPA process. This UI demo does not execute diagnostics, notify engineers, or generate a production incident report.</p>
            </div>
          )}
        </section>

        <section className="panel core-health-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">6 · NETWORK PERFORMANCE</span><h2>Core Network Health</h2><p>Top-level RAN, core, service, traffic, and alarm indicators.</p></div>
            <span className="live-chip"><span className="pulse-dot" /> SAMPLE METRICS</span>
          </div>
          <div className="core-health-grid">
            {coreHealthMetrics.map(({ label, value, detail, icon: Icon, tone }) => (
              <article className="core-health-card" key={label}>
                <div className="core-health-card-top"><span>{label}</span><i className={`stat-icon ${tone}`}><Icon size={16} /></i></div>
                <strong className={label === "ACTIVE ALARMS" ? "alarm-count-value" : ""}>{value}</strong>
                <small>{detail}</small>
                <i className={`core-health-line ${tone}`} />
              </article>
            ))}
          </div>
          <p className="health-demo-note">All values shown are sample UI demo data; they are not production network telemetry.</p>
        </section>

        <section className="panel node-inventory-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">NODE INVENTORY</span><h2>Paginated Network Nodes</h2><p>Browse demo inventory by page and open a node in the topology.</p></div>
            <span className="counter">100 nodes</span>
          </div>
          <div className="inventory-row">
            <div className="inventory-current">
              <span className="inventory-index">{String(topologyPage).padStart(3, "0")}</span>
              <div><strong>{selectedPageNode.id}</strong><small>{selectedPageNode.type} · {selectedPageNode.region}</small></div>
              <span className={nodeStatusClass(selectedPageNode.status)}>{selectedPageNode.status}</span>
              <button className="small-action" onClick={() => selectTopologyNode(selectedPageNode)}>View node <ChevronRight size={12} /></button>
            </div>
            <div className="pagination">
              <button className="page-button" onClick={() => goToTopologyPage(topologyPage - 1)} disabled={topologyPage === 1} aria-label="Previous page"><ChevronRight size={14} className="previous-chevron" /></button>
              <form className="page-jump" onSubmit={submitTopologyPage}>
                <label htmlFor="topology-page">Page</label>
                <input id="topology-page" type="number" min="1" max="100" value={pageInput} onChange={(event) => setPageInput(event.target.value)} aria-label="Go to node page from 1 to 100" />
                <span>/ 100</span>
                <button className="page-button page-go" type="submit">Go</button>
              </form>
              <button className="page-button" onClick={() => goToTopologyPage(topologyPage + 1)} disabled={topologyPage === 100} aria-label="Next page"><ChevronRight size={14} /></button>
            </div>
          </div>
        </section>
      </div>
    );
  };

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

  const renderHourlyReports = () => {
    const trendColors: Record<"CS" | "PS" | "VoLTE", string> = {
      CS: "#24e9ff",
      PS: "#ff3dbf",
      VoLTE: "#9b7cff"
    };

    return (
      <div className="stack">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CORE NETWORK PERFORMANCE</span>
              <h2>Hourly CS / PS / VoLTE Report</h2>
              <p>Hourly averages, sample counts and traffic direction from ingested KPI records.</p>
            </div>
            <button className="primary-button" onClick={() => void exportHourlyReport()} disabled={reportDownloading}>
              {reportDownloading ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
              Export Excel
            </button>
          </div>
          <div className="report-toolbar">
            <label>Network
              <select className="dark-select" value={reportNetwork} onChange={(event) => setReportNetwork(event.target.value as typeof reportNetwork)}>
                <option value="all">All networks</option>
                <option value="CS">CS Core</option>
                <option value="PS">PS Core</option>
                <option value="VoLTE">VoLTE</option>
              </select>
            </label>
            <label>Period
              <select className="dark-select" value={reportHours} onChange={(event) => setReportHours(Number(event.target.value))}>
                <option value={24}>Last 24 hours</option>
                <option value={72}>Last 72 hours</option>
                <option value={168}>Last 7 days</option>
              </select>
            </label>
            <label>Metric
              <select className="dark-select" value={selectedReportMetric} onChange={(event) => setReportMetric(event.target.value)} disabled={!reportMetrics.length}>
                {reportMetrics.length
                  ? reportMetrics.map((metric) => <option key={metric} value={metric}>{metric}</option>)
                  : <option value="">No metrics</option>}
              </select>
            </label>
            <span className="report-refresh-state">
              {reportLoading ? <LoaderCircle size={13} className="spin" /> : <Clock3 size={13} />}
              {reportUpdated ? `Updated ${reportUpdated.toLocaleTimeString()}` : "Waiting for report"}
            </span>
          </div>
          <div className="stats-grid report-stats">
            {([
              ["CS", "CS CORE", "cyan"],
              ["PS", "PS CORE", "pink"],
              ["VoLTE", "VoLTE", "purple"]
            ] as const).map(([networkType, label, tone]) => {
              const latest = latestByNetwork[networkType];
              return (
                <StatCard
                  key={networkType}
                  label={`${label} · ${selectedReportMetric || "NO DATA"}`}
                  value={latest ? `${number(latest.average)} ${latest.unit}` : "—"}
                  detail={latest ? `${latest.direction === "NO_BASELINE" ? "No prior hour" : `${latest.change_percent === null ? latest.direction.toLowerCase() : `${number(latest.change_percent)}% ${latest.direction.toLowerCase()}`}`} · ${latest.samples} samples` : "No KPI samples in this period"}
                  icon={Activity}
                  tone={tone}
                />
              );
            })}
          </div>
          <div className="chart-area report-chart">
            {reportChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={reportChartData} margin={{ top: 12, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid stroke="#1c2940" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit" })} tick={{ fill: "#73849e", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#73849e", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value)}
                    contentStyle={{ background: "#0b1221", border: "1px solid #264056", borderRadius: 10 }}
                  />
                  {(["CS", "PS", "VoLTE"] as const).map((networkType) => (
                    reportNetwork === "all" || reportNetwork === networkType
                      ? <Area key={networkType} type="monotone" dataKey={networkType} name={`${networkType} Core`} stroke={trendColors[networkType]} fill="none" connectNulls={false} />
                      : null
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text={token ? "No KPI samples in this time window. Ingest core-network KPIs to populate the hourly report." : "Connect with an API token to load hourly reports."} />
            )}
          </div>
          <div className="report-source-note">
            Hourly robot checks run on the backend and this report refreshes every 60 seconds while open.
            Live CS/PS core or VoLTE measurements require a configured NMS/vendor feed to send KPI records to the API.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div><span className="eyebrow">HOURLY AGGREGATION</span><h2>Pivot Summary</h2><p>Grouped by network, metric and hour; change compares with the previous available hour.</p></div>
            <span className="counter">{hourlyReport?.record_count ?? 0} source records</span>
          </div>
          <Table
            data={[...(hourlyReport?.items ?? [])].reverse()}
            empty="No KPI records available for this report period."
            columns={[
              { label: "NETWORK", render: (item) => <span className="network-tag">{field(item, ["network_type"])}</span> },
              { label: "METRIC", render: (item) => <strong>{field(item, ["metric_name"])}</strong> },
              { label: "HOUR", render: (item) => formatDate(field(item, ["hour"])) },
              { label: "SAMPLES", render: (item) => number(field(item, ["samples"], 0), 0) },
              { label: "AVERAGE", render: (item) => `${number(field(item, ["average"]))} ${field(item, ["unit"], "")}` },
              { label: "MIN / MAX", render: (item) => `${number(field(item, ["minimum"]))} / ${number(field(item, ["maximum"]))}` },
              { label: "CHANGE", render: (item) => {
                const direction = String(field(item, ["direction"], "NO_BASELINE"));
                return direction === "NO_BASELINE" ? "—" : <span className={`trend-value ${direction.toLowerCase()}`}>{item.change_percent === null ? direction : `${number(item.change_percent)}% ${direction}`}</span>;
              } }
            ]}
          />
        </section>
      </div>
    );
  };

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

  const renderGeographicMap = () => {
    const region = geographicRegions.find((item) => item.name === selectedRegion) ?? geographicRegions[2];
    const regionNodes = demoNetworkNodes.filter((node) => node.region === region.name);
    return (
      <div className="stack">
        <section className="panel geographic-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">MYANMAR · REGIONAL OPERATIONS</span><h2>Geographic Network Topology</h2><p>Select a region to inspect demo BTS, cell, and service health.</p></div>
            <span className="live-chip"><Globe2 size={13} /> DEMO MAP</span>
          </div>
          <div className="geographic-layout">
            <div className="myanmar-map-wrap">
              <svg className="myanmar-map-shape" viewBox="0 0 360 500" role="img" aria-label="Stylized Myanmar map with clickable network regions">
                <defs><linearGradient id="myanmarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#153b52" /><stop offset="1" stopColor="#111b35" /></linearGradient></defs>
                <path d="M122 19 L197 34 L222 76 L205 112 L236 144 L214 180 L233 211 L209 243 L219 277 L194 306 L208 340 L180 376 L188 409 L160 437 L145 478 L124 462 L130 420 L111 386 L118 351 L96 326 L111 292 L91 263 L112 234 L91 202 L116 174 L98 144 L123 119 L104 88 L128 65 Z" fill="url(#myanmarFill)" stroke="#24e9ff" strokeOpacity=".48" strokeWidth="2" />
                <path d="M122 19 L197 34 L222 76 L205 112 L236 144 L214 180 L233 211 L209 243 L219 277 L194 306 L208 340 L180 376 L188 409 L160 437 L145 478 L124 462 L130 420 L111 386 L118 351 L96 326 L111 292 L91 263 L112 234 L91 202 L116 174 L98 144 L123 119 L104 88 L128 65 Z" fill="none" stroke="#24e9ff" strokeOpacity=".13" strokeDasharray="4 7" strokeWidth="8" />
                <path d="M160 59 C146 124 162 163 156 220 S171 321 148 385 L143 447 M113 258 C143 246 177 254 211 242" fill="none" stroke="#24e9ff" strokeOpacity=".19" strokeDasharray="3 6" />
              </svg>
              {geographicRegions.map((item) => (
                <button key={item.name} className={`map-region-marker ${item.status.toLowerCase()} ${selectedRegion === item.name ? "selected" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} onClick={() => {
                  setSelectedRegion(item.name);
                  setSelectedMapCell(item.cellIds[0].id);
                }}>
                  <i className={`node-indicator ${item.status.toLowerCase()}`} /><span>{item.name}</span>
                </button>
              ))}
              <div className="map-title-mark">MYANMAR <small>NETWORK REGION MAP</small></div>
            </div>
            <aside className="region-detail-card">
              <span className="eyebrow">SELECTED REGION</span>
              <div className="region-detail-title"><MapPin size={16} /><strong>{region.name}</strong><span className={nodeStatusClass(region.status)}>{region.status}</span></div>
              <div className="region-metric-grid">
                <div><span>AVAILABILITY</span><strong>{region.availability}</strong></div>
                <div><span>ACTIVE CELLS</span><strong>{region.cells}</strong></div>
                <div><span>NODE RECORDS</span><strong>{regionNodes.length || Math.max(3, Math.round(region.cells / 2))}</strong></div>
                <div><span>24H TRAFFIC</span><strong>{region.traffic}</strong></div>
              </div>
              <span className="eyebrow regional-nodes-label">BTS / CELL DRILL-DOWN</span>
              <div className="regional-cell-list">
                {region.cellIds.map((cell) => (
                  <button key={cell.id} className={`cell-chip ${selectedMapCell === cell.id ? "selected" : ""}`} onClick={() => setSelectedMapCell(cell.id)}>
                    <i className={`node-indicator ${cell.status.toLowerCase()}`} />{cell.id}
                  </button>
                ))}
              </div>
              <div className={`regional-cell-kpi ${selectedRegion === "Yangon" && selectedMapCell === "AHLONE-003" ? "critical" : ""}`}>
                <span>SELECTED CELL KPI · {selectedMapCell}</span>
                <strong>{selectedRegion === "Yangon" && selectedMapCell === "AHLONE-003" ? "91.4% availability" : `${region.availability} availability`}</strong>
                <small>{region.traffic} regional traffic · {Math.max(1, Math.round(region.cells / region.cellIds.length))} cells per listed sector</small>
              </div>
              <span className="eyebrow regional-nodes-label">REGIONAL NODES</span>
              <div className="regional-node-list">
                {(regionNodes.length ? regionNodes.slice(0, 4) : demoNetworkNodes.slice(0, 3)).map((node) => (
                  <div key={node.id}><i className={`node-indicator ${node.status.toLowerCase()}`} /><strong>{node.id}</strong><small>{node.type}</small></div>
                ))}
              </div>
              <button className="primary-button region-drill-button" onClick={() => {
                const node = regionNodes[0] ?? demoNetworkNodes[0];
                selectTopologyNode(node);
                setSection("Network Topology");
              }}><Network size={14} /> Drill into region topology</button>
            </aside>
          </div>
          <div className="topology-legend">
            {(["ONLINE", "DEGRADED", "CRITICAL"] as NodeStatus[]).map((status) => <span key={status}><i className={`node-indicator ${status.toLowerCase()}`} />{status}</span>)}
            <span className="topology-refresh-time">Regional health is illustrative demo data.</span>
          </div>
        </section>
      </div>
    );
  };

  const renderDependencyMap = () => {
    const dependencies = dependencyTarget === "PGW-01"
      ? [
          { name: "Internet Data", status: "CRITICAL" as NodeStatus, detail: "External packet data service" },
          { name: "Mobile Data", status: "CRITICAL" as NodeStatus, detail: "Mobile subscriber data sessions" },
          { name: "Enterprise VPN", status: "DEGRADED" as NodeStatus, detail: "Business VPN connectivity" }
        ]
      : [
          { name: "VoLTE", status: "CRITICAL" as NodeStatus, detail: "IMS-based voice service" },
          { name: "Voice", status: "CRITICAL" as NodeStatus, detail: "Voice session establishment" },
          { name: "SMS over IMS", status: "DEGRADED" as NodeStatus, detail: "IMS messaging service" }
        ];
    return (
      <section className="panel dependency-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">SERVICE IMPACT ANALYSIS</span><h2>Network Dependency Map</h2><p>Choose an impaired network node to see its downstream service impact.</p></div>
          <span className="live-chip"><Network size={13} /> DEMO DEPENDENCIES</span>
        </div>
        <div className="dependency-root-select">
          {(["PGW-01", "IMS-02"] as const).map((node) => (
            <button key={node} className={`dependency-root-button ${dependencyTarget === node ? "selected" : ""}`} onClick={() => setDependencyTarget(node)}>
              <i className="node-indicator critical" /><strong>{node}</strong><span>CRITICAL</span>
            </button>
          ))}
        </div>
        <div className="dependency-tree">
          <div className="dependency-source">
            <AlertTriangle size={18} /><span><strong>{dependencyTarget}</strong><small>SIMULATED NODE FAILURE</small></span>
          </div>
          <div className="dependency-connector"><i /></div>
          <div className="dependency-impact-list">
            {dependencies.map((dependency) => (
              <article className={`dependency-impact ${dependency.status.toLowerCase()}`} key={dependency.name}>
                <span className={`node-indicator ${dependency.status.toLowerCase()}`} />
                <div><strong>{dependency.name}</strong><small>{dependency.detail}</small></div>
                <span className={nodeStatusClass(dependency.status)}>{dependency.status}</span>
              </article>
            ))}
          </div>
        </div>
        <p className="demo-data-note">Dependency paths and impact severity are illustrative. Confirm service mappings with the production NMS/service inventory.</p>
      </section>
    );
  };

  const renderHistoricalTimeline = () => {
    const actualItems = hourlyReport?.items.filter((item) =>
      item.metric_name.toLowerCase().includes(timelineMetric.toLowerCase())
      && (reportNetwork === "all" || item.network_type === reportNetwork)
    ) ?? [];
    const timelineData = actualItems.length
      ? actualItems.slice(-24).map((item) => ({ hour: item.hour, value: item.average, unit: item.unit }))
      : Array.from({ length: 13 }, (_, index) => {
          const base = timelineMetric === "Latency" ? 22 : timelineMetric === "Traffic" ? 1.25 : timelineMetric === "DCR" ? 1.4 : timelineMetric === "CSSR" ? 98.4 : timelineMetric === "VoLTE" ? 97.6 : 98.7;
          const amplitude = timelineMetric === "Latency" ? 8 : timelineMetric === "Traffic" ? 0.35 : timelineMetric === "DCR" ? 0.35 : 0.8;
          return {
            hour: new Date(Date.now() - (12 - index) * 2 * 60 * 60 * 1000).toISOString(),
            value: Number((base + Math.sin(index * 0.8) * amplitude + Math.cos(index * 0.35) * amplitude * 0.3).toFixed(2)),
            unit: timelineMetric === "Traffic" ? "Gbps" : timelineMetric === "Latency" ? "ms" : "%"
          };
        });
    return (
      <section className="panel history-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">ANALYTICS · 24 HOUR WINDOW</span><h2>Historical KPI Timeline</h2><p>Hourly report data when available; otherwise an explicitly labeled demo trend.</p></div>
          <span className={`live-chip ${actualItems.length ? "" : "demo-chip"}`}>{actualItems.length ? "API REPORT DATA" : "DEMO SERIES"}</span>
        </div>
        <div className="history-toolbar">
          <label>Metric<select className="dark-select" value={timelineMetric} onChange={(event) => setTimelineMetric(event.target.value as HistoryMetric)}>{historyMetrics.map((metric) => <option key={metric}>{metric}</option>)}</select></label>
          <label>Network<select className="dark-select" value={reportNetwork} onChange={(event) => setReportNetwork(event.target.value as typeof reportNetwork)}><option value="all">All networks</option><option value="CS">CS</option><option value="PS">PS</option><option value="VoLTE">VoLTE</option></select></label>
          <button className="secondary-button" onClick={() => token ? void loadHourlyReport(token) : setNotice("Connect an API token to load actual hourly KPI history.")} disabled={reportLoading}><RefreshCw size={13} className={reportLoading ? "spin" : ""} /> Load hourly data</button>
        </div>
        {reportLoading && <div className="loading-strip"><LoaderCircle size={14} className="spin" /> Loading historical report data…</div>}
        <div className="chart-area history-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 12, right: 10, left: -16, bottom: 4 }}>
              <defs><linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#24e9ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#24e9ff" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="#1c2940" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="hour" tickFormatter={(value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit" })} tick={{ fill: "#73849e", fontSize: 9 }} />
              <YAxis tick={{ fill: "#73849e", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(value) => formatDate(value)} formatter={(value) => [`${number(value)} ${timelineData[0]?.unit ?? ""}`, timelineMetric]} contentStyle={{ background: "#0b1221", border: "1px solid #264056", borderRadius: 10 }} />
              <Area type="monotone" dataKey="value" stroke="#24e9ff" strokeWidth={2.2} fill="url(#historyFill)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="history-footer"><span><i className="legend-dot cyan-dot" />{timelineMetric} · {timelineData.length} points</span><span>{actualItems.length ? `Report updated ${reportUpdated?.toLocaleTimeString() ?? "recently"}` : "Sample values — not production telemetry"}</span></div>
      </section>
    );
  };

  const renderPredictions = () => (
    <section className="panel prediction-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">APEXIVEAI INTELLIGENCE</span><h2>AI / Predictive Operations</h2><p>Illustrative early-warning signal and recommended next action.</p></div>
        <span className="live-chip demo-chip"><Zap size={13} /> DEMO PREDICTION</span>
      </div>
      <div className="prediction-card">
        <div className="prediction-alert-icon"><AlertTriangle size={20} /></div>
        <div className="prediction-summary"><span className="eyebrow">PREDICTED INCIDENT</span><h3>AHLONE-003 availability degradation</h3><p>Potential cell service impact detected in Yangon region.</p></div>
        <div className="prediction-probability"><strong>87%</strong><span>probability</span></div>
      </div>
      <div className="prediction-detail-grid">
        <div><span>EXPECTED DEGRADATION</span><strong>~ 18 minutes</strong></div>
        <div><span>REGION / CELL</span><strong>Yangon · AHLONE-003</strong></div>
      </div>
      <div className="prediction-reasons">
        <span className="eyebrow">SIGNAL CONTRIBUTORS</span>
        <div><AlertTriangle size={13} /> Rising packet loss</div>
        <div><Activity size={13} /> Increasing latency</div>
        <div><Network size={13} /> Traffic imbalance</div>
      </div>
      <div className="prediction-action-row">
        <p>Recommendation: run the diagnostic workflow and review affected cell KPIs.</p>
        <button className="primary-button" onClick={() => { setAutomationWorkflowOpen(true); setSection("Workflow Monitor"); }}><Zap size={14} /> Review diagnostic workflow</button>
      </div>
      <p className="demo-data-note">Prediction probability, causes, and time estimate are demo content, not an ML model output or live forecast.</p>
    </section>
  );

  const renderServiceHealth = () => (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">SERVICE ASSURANCE</span><h2>Service Health</h2><p>Demo service availability and impact overview.</p></div><span className="live-chip demo-chip">DEMO INVENTORY</span></div>
        <div className="service-health-list">
          {[["Internet Data", "CRITICAL", "PGW-01"], ["Mobile Data", "CRITICAL", "PGW-01"], ["Enterprise VPN", "DEGRADED", "PGW-01"], ["VoLTE", "CRITICAL", "IMS-02"], ["SMS over IMS", "DEGRADED", "IMS-02"]].map(([name, status, dependency]) => (
            <button key={name} className="service-health-row" onClick={() => { setDependencyTarget(dependency as "PGW-01" | "IMS-02"); setSection("Network Dependency Map"); }}>
              <i className={`node-indicator ${status.toLowerCase()}`} /><strong>{name}</strong><span>{dependency}</span><span className={nodeStatusClass(status as NodeStatus)}>{status}</span><ChevronRight size={14} />
            </button>
          ))}
        </div>
      </section>
      {renderGeographicMap()}
    </div>
  );

  const renderWorkflowMonitor = () => (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">RPA CONTROL</span><h2>Workflow Monitor</h2><p>Workflow status from the current demonstration.</p></div><span className="live-chip demo-chip">SIMULATED</span></div>
        <div className="workflow-monitor-card"><div><span className="eyebrow">ACTIVE DIAGNOSTIC</span><h3>AHLONE-003 · Critical Availability</h3><p>Incident MPT-20261017-0842 · Started 16:02</p></div><button className="small-action" onClick={() => setAutomationWorkflowOpen((open) => !open)}>{automationWorkflowOpen ? "Hide trace" : "Show trace"} <ChevronRight size={13} /></button></div>
        {automationWorkflowOpen && <div className="workflow-monitor-steps">{["Detect abnormal KPI", "Collect related KPIs", "Compare threshold", "Identify affected cells", "Generate incident", "Notify operation team", "Generate report"].map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong><CheckCircle2 size={14} /></div>)}</div>}
      </section>
      {renderJobs()}
    </div>
  );

  const renderIntegrationInfo = (settings = false) => (
    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">{settings ? "ADMINISTRATION" : "CONNECTIVITY"}</span><h2>{settings ? "System Settings" : "API / Integration"}</h2><p>{settings ? "Runtime configuration overview." : "Integration status and production data requirements."}</p></div><span className="live-chip demo-chip">CONFIGURATION VIEW</span></div>
      <div className="integration-state"><span className={`pulse-dot ${health === "offline" ? "pulse-off" : ""}`} /><div><strong>{health === "online" ? "Application API reachable" : "Application API unavailable"}</strong><small>Topology/NMS collector integration is not configured in this UI.</small></div></div>
      <div className="integration-requirements">
        <div><span>01</span><strong>Vendor / NMS endpoint</strong><small>Provide authenticated node, cell, alarm, and service-inventory APIs.</small></div>
        <div><span>02</span><strong>Telemetry ingestion</strong><small>Send normalized KPI and timestamp data to the backend collector.</small></div>
        <div><span>03</span><strong>Secure operations</strong><small>Configure credentials, network access, retention, and audit controls server-side.</small></div>
      </div>
      <p className="demo-data-note">No credentials or external integrations are changed by this configuration page.</p>
    </section>
  );

  const content = {
    "Network Topology": renderTopology,
    Overview: renderOverview,
    "Geographic Map": renderGeographicMap,
    "Network KPIs": renderKpis,
    "Hourly Reports": renderHourlyReports,
    "Historical KPI Timeline": renderHistoricalTimeline,
    "Alerts Center": renderAlerts,
    "Service Health": renderServiceHealth,
    "Network Dependency Map": renderDependencyMap,
    "Automation Jobs": renderJobs,
    "Workflow Monitor": renderWorkflowMonitor,
    "RPA Execution History": renderJobs,
    Thresholds: renderThresholds,
    "Performance Analytics": renderHistoricalTimeline,
    "Traffic Analytics": renderHistoricalTimeline,
    "AI Predictions": renderPredictions,
    "API / Integration": () => renderIntegrationInfo(false),
    "System Settings": () => renderIntegrationInfo(true),
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
          {navGroups.map(({ heading, sections }) => (
            <div className="nav-group" key={heading}>
              <span className="nav-heading">{heading}</span>
              {sections.map((label) => {
                const item = navItems.find((navItem) => navItem.label === label);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => { setSection(label); setMobileNav(false); }}>
                    <Icon size={17} /><span>{label}</span>{label === "Alerts Center" && activeAlerts.length > 0 && <i className="nav-count">{activeAlerts.length}</i>}
                  </button>
                );
              })}
            </div>
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
