import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { PropertyWithSocial, SocialContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Pen,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Platform = "instagram" | "twitter" | "reel";

const platformMeta: Record<Platform, { label: string; getContent: (s: SocialContent) => string | null; statusKey: keyof SocialContent }> = {
  instagram: { label: "Instagram", getContent: (s) => s.instagramCaption, statusKey: "instagramStatus" },
  twitter: { label: "X / Twitter", getContent: (s) => s.twitterPost, statusKey: "twitterStatus" },
  reel: { label: "Reel Script", getContent: (s) => s.reelScript, statusKey: "reelStatus" },
};

const statusBadge: Record<string, string> = {
  pending: "border-amber-300 text-amber-600 bg-amber-50",
  approved: "border-emerald-300 text-emerald-600 bg-emerald-50",
  rejected: "border-red-300 text-red-500 bg-transparent",
  posted: "border-sky-300 text-sky-600 bg-sky-50",
};

const fmt = new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ── Single Platform Block ── */
function PlatformBlock({
  propertyId,
  platform,
  social,
}: {
  propertyId: number;
  platform: Platform;
  social: SocialContent;
}) {
  const { toast } = useToast();
  const meta = platformMeta[platform];
  const content = meta.getContent(social);
  const status = social[meta.statusKey] as string;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content || "");

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/properties/${propertyId}/social/status`, { platform, status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: `${meta.label} status updated` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const textMutation = useMutation({
    mutationFn: async (text: string) => {
      await apiRequest("PATCH", `/api/properties/${propertyId}/social/text`, { platform, text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditing(false);
      toast({ title: `${meta.label} updated` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content || "");
      toast({ title: "Copied" });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast({ title: "Copied" });
    }
  };

  if (!content) {
    return <p className="text-xs text-muted-foreground">Not generated</p>;
  }

  return (
    <div data-testid={`platform-${platform}-${propertyId}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium">{meta.label}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusBadge[status] || ""}`}>{status}</Badge>
        <div className="flex gap-0.5 ml-auto">
          <button onClick={handleCopy} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Copy">
            <Copy className="h-3 w-3" />
          </button>
          {status === "pending" && (
            <>
              <button
                onClick={() => setEditing(!editing)}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                title="Edit"
                data-testid={`edit-${platform}-${propertyId}`}
              >
                <Pen className="h-3 w-3" />
              </button>
              <button
                onClick={() => statusMutation.mutate("approved")}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600"
                title="Approve"
                data-testid={`approve-${platform}-${propertyId}`}
              >
                <CheckCircle2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => statusMutation.mutate("rejected")}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-red-500"
                title="Reject"
                data-testid={`reject-${platform}-${propertyId}`}
              >
                <XCircle className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="text-xs"
            data-testid={`textarea-${platform}-${propertyId}`}
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-5 text-[10px] px-2" onClick={() => textMutation.mutate(editText)} disabled={textMutation.isPending}>Save</Button>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => { setEditing(false); setEditText(content); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/30 rounded p-2 max-h-28 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  );
}

/* ── Property Row ── */
function PropertyRow({ property }: { property: PropertyWithSocial }) {
  const [expanded, setExpanded] = useState(true);
  const social = property.socialContent;
  if (!social) return null;

  const platforms: Platform[] = ["instagram", "twitter", "reel"];
  const approvedCount = platforms.filter(
    (p) => {
      const s = social[platformMeta[p].statusKey] as string;
      return s === "approved" || s === "posted";
    }
  ).length;

  return (
    <div className="border rounded" data-testid={`content-card-${property.id}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2">
        {property.leadPhoto && (
          <img src={property.leadPhoto} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
        )}
        <Link href={`/properties/${property.id}`} className="flex-1 min-w-0 hover:underline">
          <span className="text-sm font-medium truncate block">{property.town}, {property.province}</span>
          <span className="text-xs text-muted-foreground">{property.region}</span>
        </Link>
        <span className="text-sm font-medium shrink-0">{fmt.format(property.price)}</span>
        {property.socialPotentialScore >= 70 && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-500 shrink-0">
            <Sparkles className="h-3 w-3" />
            {property.socialPotentialScore}
          </span>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{approvedCount}/3</Badge>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-accent text-muted-foreground shrink-0"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded: platforms in columns */}
      {expanded && (
        <div className="border-t px-3 py-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          {platforms.map((platform) => (
            <PlatformBlock
              key={platform}
              propertyId={property.id}
              platform={platform}
              social={social}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Content Pipeline Page ── */
export default function ContentPipeline() {
  const [filter, setFilter] = useState("all");
  const { data: queue, isLoading } = useQuery<PropertyWithSocial[]>({
    queryKey: ["/api/content-queue"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">Content</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const items = queue || [];

  const filtered = filter === "all"
    ? items
    : filter === "pending"
      ? items.filter((p) => {
        const s = p.socialContent;
        return s && (s.instagramStatus === "pending" || s.twitterStatus === "pending" || s.reelStatus === "pending");
      })
      : filter === "approved"
        ? items.filter((p) => {
          const s = p.socialContent;
          return s && (s.instagramStatus === "approved" || s.twitterStatus === "approved" || s.reelStatus === "approved");
        })
        : items;

  return (
    <div className="space-y-3" data-testid="content-pipeline-page">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Content</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} properties</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="filter-status">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({items.length})</SelectItem>
            <SelectItem value="pending">Pending review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No content to review. Select properties to queue them for content generation.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((property) => (
            <PropertyRow key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
