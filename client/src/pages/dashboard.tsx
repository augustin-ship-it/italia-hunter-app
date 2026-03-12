import { useQuery, useMutation } from "@tanstack/react-query";
import type { StatsResponse, Property } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/* ── Pipeline Progress Bar ── */
function PipelineBar({ pipeline }: { pipeline: StatsResponse["pipeline"] }) {
  const stages = [
    { key: "qualified", label: "Qualified", count: pipeline.qualified, color: "bg-amber-400" },
    { key: "selected", label: "Selected", count: pipeline.selected, color: "bg-sky-400" },
    { key: "content_ready", label: "Content Ready", count: pipeline.content_ready, color: "bg-violet-400" },
    { key: "posted", label: "Posted", count: pipeline.posted, color: "bg-emerald-400" },
  ];
  const total = stages.reduce((s, st) => s + st.count, 0) || 1;

  return (
    <div data-testid="pipeline-funnel">
      <div className="flex items-center gap-4 mb-2">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${stage.color}`} />
            <span>{stage.label}</span>
            <span className="font-medium text-foreground">{stage.count}</span>
          </div>
        ))}
        {pipeline.rejected > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>Rejected</span>
            <span className="font-medium text-foreground">{pipeline.rejected}</span>
          </div>
        )}
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className={`${stage.color} transition-all`}
            style={{ width: `${(stage.count / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Stat Row ── */
function StatRow({ stats }: { stats: StatsResponse }) {
  const items = [
    { label: "Total", value: stats.totalProperties },
    { label: "Qualified today", value: stats.qualifiedToday },
    { label: "Selected", value: stats.selected },
    { label: "Content ready", value: stats.contentReady },
    { label: "Posted", value: stats.posted },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1" data-testid="stat-total">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold">{item.value}</span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Top Properties List ── */
function TopProperties() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ properties: Property[]; total: number }>({
    queryKey: ["/api/properties?status=qualified&sort=-socialPotentialScore&limit=8"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/properties/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;
  const properties = data?.properties || [];
  if (properties.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground" data-testid="top-properties">
        No qualified properties to review. Import data to get started.
      </div>
    );
  }

  return (
    <div data-testid="top-properties">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-muted-foreground">Top properties to review</h2>
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" data-testid="view-all-properties">
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
      <div className="border rounded divide-y">
        {properties.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors"
            data-testid={`dash-property-${p.id}`}
          >
            {p.leadPhoto ? (
              <img src={p.leadPhoto} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted shrink-0" />
            )}
            <Link href={`/properties/${p.id}`} className="flex-1 min-w-0 hover:underline">
              <span className="text-sm font-medium truncate block">{p.town}, {p.province}</span>
              <span className="text-xs text-muted-foreground">{p.region}</span>
            </Link>
            <span className="text-sm font-medium text-foreground shrink-0">
              {new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p.price)}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{p.compositeScore}</span>
            {p.socialPotentialScore >= 70 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-500 shrink-0">
                <Sparkles className="h-3 w-3" />
                {p.socialPotentialScore}
              </span>
            )}
            <div className="flex gap-0.5 shrink-0">
              <button
                onClick={() => statusMutation.mutate({ id: p.id, status: "selected" })}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600 transition-colors"
                data-testid={`dash-select-${p.id}`}
                title="Select"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => statusMutation.mutate({ id: p.id, status: "rejected" })}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors"
                data-testid={`dash-reject-${p.id}`}
                title="Reject"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Latest Batch ── */
function LatestBatch({ batch }: { batch: StatsResponse["latestBatch"] }) {
  if (!batch) return null;
  return (
    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1" data-testid="latest-batch">
      <span>Latest batch: <span className="text-foreground font-medium">{batch.date}</span></span>
      <span>Status: <span className={`font-medium ${batch.status === "completed" ? "text-emerald-600" : batch.status === "failed" ? "text-red-500" : "text-amber-500"}`}>{batch.status}</span></span>
      <span>Raw: <span className="text-foreground font-medium">{batch.rawCount}</span></span>
      <span>Qualified: <span className="text-foreground font-medium">{batch.qualifiedCount}</span></span>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<StatsResponse>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <h1 className="text-base font-semibold">Dashboard</h1>
        <Skeleton className="h-6" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      <h1 className="text-base font-semibold">Dashboard</h1>

      {/* Inline stats */}
      <StatRow stats={stats} />

      {/* Pipeline progress */}
      <PipelineBar pipeline={stats.pipeline} />

      {/* Top properties */}
      <TopProperties />

      {/* Latest batch */}
      <LatestBatch batch={stats.latestBatch} />
    </div>
  );
}
