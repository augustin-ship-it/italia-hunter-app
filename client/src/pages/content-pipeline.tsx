import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import type { PropertyWithSocial, SocialContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Pen,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Twitter,
  ExternalLink,
  Send,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Platform = "instagram" | "twitter";

const platformMeta: Record<Platform, { label: string; icon: typeof Instagram; getContent: (s: SocialContent) => string | null; statusKey: keyof SocialContent; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, getContent: (s) => s.instagramCaption, statusKey: "instagramStatus", color: "text-pink-500" },
  twitter: { label: "X / Twitter", icon: Twitter, getContent: (s) => s.twitterPost, statusKey: "twitterStatus", color: "text-sky-500" },
};

const statusStyles: Record<string, string> = {
  pending: "border-amber-300/60 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 dark:text-amber-400",
  approved: "border-emerald-300/60 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 dark:text-emerald-400",
  rejected: "border-red-300/60 text-red-500 bg-red-50/50 dark:bg-red-950/20 dark:text-red-400",
  posted: "border-sky-300/60 text-sky-600 bg-sky-50/50 dark:bg-sky-950/20 dark:text-sky-400",
};

const fmt = new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ── Carousel Preview ── */
function CarouselPreview({ photos }: { photos: string[] }) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: current * trackRef.current.clientWidth, behavior: "smooth" });
    }
  }, [current]);

  if (!photos || photos.length === 0) return null;

  return (
    <div className="relative group" data-testid="carousel-preview">
      <div
        ref={trackRef}
        className="flex overflow-hidden rounded-lg snap-x snap-mandatory"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {photos.map((url, i) => (
          <div key={i} className="snap-center shrink-0 w-full aspect-[4/3] bg-muted">
            <img
              src={url}
              alt={`Slide ${i + 1}`}
              className="w-full h-full object-cover"
              loading={i < 2 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      {/* Prev/Next */}
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
            disabled={current === 0}
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrent(Math.min(photos.length - 1, current + 1))}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
            disabled={current === photos.length - 1}
            data-testid="carousel-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
      {/* Dots */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all ${i === current ? "w-3 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
      <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded-full">
        {current + 1}/{photos.length}
      </span>
    </div>
  );
}

/* ── Platform Content Block ── */
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
  const Icon = meta.icon;
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
      toast({ title: "Copied to clipboard" });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast({ title: "Copied to clipboard" });
    }
  };

  if (!content) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Icon className="h-3.5 w-3.5" />
        <span>Not generated</span>
      </div>
    );
  }

  return (
    <div data-testid={`platform-${platform}-${propertyId}`} className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        <span className="text-xs font-medium">{meta.label}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusStyles[status] || ""}`}>
          {status}
        </Badge>
        <div className="flex gap-0.5 ml-auto">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Copy">
            <Copy className="h-3 w-3" />
          </button>
          {status === "pending" && (
            <>
              <button
                onClick={() => setEditing(!editing)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title="Edit"
                data-testid={`edit-${platform}-${propertyId}`}
              >
                <Pen className="h-3 w-3" />
              </button>
              <button
                onClick={() => statusMutation.mutate("approved")}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600"
                title="Approve"
                data-testid={`approve-${platform}-${propertyId}`}
              >
                <CheckCircle2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => statusMutation.mutate("rejected")}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500"
                title="Reject"
                data-testid={`reject-${platform}-${propertyId}`}
              >
                <XCircle className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="space-y-1.5">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={6}
            className="text-xs font-mono"
            data-testid={`textarea-${platform}-${propertyId}`}
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[10px] px-2.5" onClick={() => textMutation.mutate(editText)} disabled={textMutation.isPending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2.5" onClick={() => { setEditing(false); setEditText(content); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 max-h-44 overflow-y-auto border border-border/30">
          {content}
        </div>
      )}
      {/* Char count */}
      {!editing && (
        <div className="text-[10px] text-muted-foreground">
          {content.length} characters
          {platform === "twitter" && content.length > 280 && (
            <span className="text-red-500 ml-1">(over 280 limit)</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Property Content Card ── */
function PropertyContentCard({ property }: { property: PropertyWithSocial }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const social = property.socialContent;
  if (!social) return null;

  const platforms: Platform[] = ["instagram", "twitter"];
  const approvedCount = platforms.filter((p) => {
    const s = social[platformMeta[p].statusKey] as string;
    return s === "approved" || s === "posted";
  }).length;

  const allApproved = approvedCount === 2;
  const photos = social.carouselPhotos || [];

  const publishMutation = useMutation({
    mutationFn: async ({ platform }: { platform: "instagram" | "twitter" }) => {
      const res = await apiRequest("POST", "/api/buffer/publish", { propertyId: property.id, platform });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries();
      const label = data.platform === "instagram" ? "Instagram" : "X";
      toast({ title: `Published to ${label} via Buffer` });
    },
    onError: (error: Error) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        allApproved ? "border-emerald-200/60 dark:border-emerald-800/30" : ""
      }`}
      data-testid={`content-card-${property.id}`}
    >
      {/* Compact header */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {property.leadPhoto && (
          <img src={property.leadPhoto} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{property.town}, {property.province}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 capitalize">
              {property.propertyType}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{fmt.format(property.price)}</span>
            {property.size && <span className="text-xs text-muted-foreground">{property.size}m²</span>}
            <span className="text-xs text-muted-foreground capitalize">{property.region}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {property.socialPotentialScore >= 70 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-500">
              <Sparkles className="h-3 w-3" />
              {property.socialPotentialScore}
            </span>
          )}
          {/* Platform status dots */}
          <div className="flex gap-1">
            {platforms.map((p) => {
              const s = social[platformMeta[p].statusKey] as string;
              return (
                <div
                  key={p}
                  className={`h-2 w-2 rounded-full ${
                    s === "approved" || s === "posted" ? "bg-emerald-500" :
                    s === "rejected" ? "bg-red-500" :
                    "bg-amber-400"
                  }`}
                  title={`${platformMeta[p].label}: ${s}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-muted-foreground">{approvedCount}/2</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t">
          {/* Carousel + IG content side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-0">
            {/* Left: Carousel preview */}
            {photos.length > 0 && (
              <div className="p-3 lg:border-r border-b lg:border-b-0">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Carousel Preview ({photos.length} photos)
                </div>
                <CarouselPreview photos={photos} />
              </div>
            )}
            {/* Right: Content tabs */}
            <div className="p-3">
              <Tabs defaultValue="instagram">
                <TabsList className="h-7 mb-3">
                  <TabsTrigger value="instagram" className="text-[11px] h-6 px-2.5 gap-1">
                    <Instagram className="h-3 w-3" /> IG
                  </TabsTrigger>
                  <TabsTrigger value="twitter" className="text-[11px] h-6 px-2.5 gap-1">
                    <Twitter className="h-3 w-3" /> X
                  </TabsTrigger>
                </TabsList>
                {platforms.map((platform) => (
                  <TabsContent key={platform} value={platform} className="mt-0">
                    <PlatformBlock propertyId={property.id} platform={platform} social={social} />
                    {/* Show first comment for Instagram */}
                    {platform === "instagram" && social.instagramFirstComment && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">First comment (hashtags)</div>
                        <div className="text-xs bg-muted/30 rounded-lg p-2 border border-border/30 text-muted-foreground">
                          {social.instagramFirstComment}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>

          {/* Action bar */}
          <div className="border-t px-3 py-2 flex items-center gap-2 bg-muted/20">
            <a
              href={property.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Idealista listing
            </a>
            <Link href={`/properties/${property.id}`} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <Eye className="h-3 w-3" /> Property detail
            </Link>
            <div className="ml-auto flex gap-1.5">
              {(social.instagramStatus === "approved") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 border-pink-200 text-pink-600 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-400 dark:hover:bg-pink-950/30"
                  onClick={() => publishMutation.mutate({ platform: "instagram" })}
                  disabled={publishMutation.isPending}
                  data-testid={`publish-ig-${property.id}`}
                >
                  <Send className="h-3 w-3" /> {publishMutation.isPending && publishMutation.variables?.platform === "instagram" ? "Publishing..." : "Publish IG"}
                </Button>
              )}
              {(social.instagramStatus === "posted") && (
                <Badge variant="outline" className="h-6 text-[10px] px-2 gap-1 border-pink-200/60 text-pink-500 bg-pink-50/50 dark:bg-pink-950/20 dark:text-pink-400">
                  <CheckCircle2 className="h-3 w-3" /> IG posted
                </Badge>
              )}
              {(social.twitterStatus === "approved") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/30"
                  onClick={() => publishMutation.mutate({ platform: "twitter" })}
                  disabled={publishMutation.isPending}
                  data-testid={`publish-x-${property.id}`}
                >
                  <Send className="h-3 w-3" /> {publishMutation.isPending && publishMutation.variables?.platform === "twitter" ? "Publishing..." : "Publish X"}
                </Button>
              )}
              {(social.twitterStatus === "posted") && (
                <Badge variant="outline" className="h-6 text-[10px] px-2 gap-1 border-sky-200/60 text-sky-500 bg-sky-50/50 dark:bg-sky-950/20 dark:text-sky-400">
                  <CheckCircle2 className="h-3 w-3" /> X posted
                </Badge>
              )}
            </div>
          </div>
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
        <h1 className="text-base font-semibold">Content Pipeline</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  const items = queue || [];

  const filtered = filter === "all"
    ? items
    : filter === "pending"
      ? items.filter((p) => {
        const s = p.socialContent;
        return s && (s.instagramStatus === "pending" || s.twitterStatus === "pending");
      })
      : filter === "approved"
        ? items.filter((p) => {
          const s = p.socialContent;
          return s && (s.instagramStatus === "approved" || s.twitterStatus === "approved");
        })
        : filter === "ready"
          ? items.filter((p) => {
            const s = p.socialContent;
            return s && s.instagramStatus === "approved" && s.twitterStatus === "approved";
          })
          : items;

  const pendingCount = items.filter((p) => {
    const s = p.socialContent;
    return s && (s.instagramStatus === "pending" || s.twitterStatus === "pending");
  }).length;
  const approvedCount = items.filter((p) => {
    const s = p.socialContent;
    return s && (s.instagramStatus === "approved" || s.twitterStatus === "approved");
  }).length;
  const readyCount = items.filter((p) => {
    const s = p.socialContent;
    return s && s.instagramStatus === "approved" && s.twitterStatus === "approved";
  }).length;

  return (
    <div className="space-y-4" data-testid="content-pipeline-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Content Pipeline</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Review, edit, and prepare content for publication</p>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} of {items.length} properties</span>
      </div>

      {/* Status summary + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-7 w-[160px] text-xs" data-testid="filter-status">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({items.length})</SelectItem>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="approved">Has approved ({approvedCount})</SelectItem>
            <SelectItem value="ready">Ready to publish ({readyCount})</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-3 ml-auto text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Pending</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Rejected</span>
        </div>
      </div>

      {/* Content cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No content to review</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Select properties from the Properties page to queue them for content generation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((property) => (
            <PropertyContentCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
