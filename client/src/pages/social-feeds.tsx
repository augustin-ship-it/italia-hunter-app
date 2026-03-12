import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Users,
  FileText,
  Heart,
  RefreshCw,
  Instagram,
} from "lucide-react";
import type { SocialContent } from "@shared/schema";

/* ── X (Twitter) Icon ── */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Types for social stats ── */
interface SocialStats {
  platform: string;
  handle: string;
  url: string;
  postsCount: number;
  approvedCount: number;
  pendingCount: number;
  postedCount: number;
}

/* ── X Embedded Timeline ── */
function XTimelineEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Load Twitter widgets.js
    const existingScript = document.getElementById("twitter-wjs");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "twitter-wjs";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.onload = () => {
        renderTimeline();
      };
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    } else {
      renderTimeline();
    }

    function renderTimeline() {
      if (containerRef.current && (window as any).twttr?.widgets) {
        containerRef.current.innerHTML = "";
        (window as any).twttr.widgets
          .createTimeline(
            { sourceType: "profile", screenName: "TheItalianExit" },
            containerRef.current,
            {
              height: 600,
              chrome: "noheader nofooter noborders transparent",
              dnt: true,
              theme: "light",
            }
          )
          .then(() => setLoaded(true))
          .catch(() => setError(true));
      }
    }
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <XIcon className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-2">
          Timeline preview unavailable
        </p>
        <a
          href="https://x.com/TheItalianExit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          View on X <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div>
      {!loaded && (
        <div className="space-y-3 py-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      <div ref={containerRef} className={loaded ? "" : "h-0 overflow-hidden"} />
    </div>
  );
}

/* ── Instagram Feed Preview ── */
function InstagramFeedPreview({
  contents,
}: {
  contents: { propertyId: number; caption: string; photo: string | null }[];
}) {
  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Instagram className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground mb-2">
          No Instagram content yet
        </p>
        <a
          href="https://www.instagram.com/theitalian.exit/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          View on Instagram <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* IG-style grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {contents.slice(0, 9).map((item, i) => (
          <div
            key={i}
            className="relative aspect-square bg-muted overflow-hidden group cursor-pointer"
            data-testid={`ig-grid-item-${i}`}
          >
            {item.photo ? (
              <img
                src={item.photo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Instagram className="h-5 w-5 text-muted-foreground/30" />
              </div>
            )}
            {/* Hover overlay with caption preview */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
              <p className="text-white text-xs line-clamp-4 text-center leading-relaxed">
                {item.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
      {contents.length > 9 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          +{contents.length - 9} more posts
        </p>
      )}
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2.5" data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="h-8 w-8 rounded bg-accent flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">
          {label}
          {sub && <span className="ml-1 text-foreground/60">{sub}</span>}
        </p>
      </div>
    </div>
  );
}

/* ── Platform Header ── */
function PlatformHeader({
  icon: Icon,
  name,
  handle,
  url,
}: {
  icon: React.ElementType;
  name: string;
  handle: string;
  url: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <div>
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground ml-1.5">
            {handle}
          </span>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
      >
        Open <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/* ── Main Page ── */
export default function SocialFeeds() {
  const { data: contentData, isLoading: contentLoading } = useQuery<{
    contents: (SocialContent & { property?: { leadPhoto: string | null; town: string; province: string } })[];
  }>({
    queryKey: ["/api/social/contents"],
  });

  const contents = contentData?.contents || [];

  // Compute stats from content data
  const xStats: SocialStats = {
    platform: "X",
    handle: "@TheItalianExit",
    url: "https://x.com/TheItalianExit",
    postsCount: contents.filter((c) => c.twitterPost).length,
    approvedCount: contents.filter((c) => c.twitterStatus === "approved").length,
    pendingCount: contents.filter((c) => c.twitterStatus === "pending").length,
    postedCount: contents.filter((c) => c.twitterStatus === "posted").length,
  };

  const igStats: SocialStats = {
    platform: "Instagram",
    handle: "@theitalian.exit",
    url: "https://www.instagram.com/theitalian.exit/",
    postsCount: contents.filter((c) => c.instagramCaption).length,
    approvedCount: contents.filter(
      (c) => c.instagramStatus === "approved"
    ).length,
    pendingCount: contents.filter(
      (c) => c.instagramStatus === "pending"
    ).length,
    postedCount: contents.filter(
      (c) => c.instagramStatus === "posted"
    ).length,
  };

  // IG grid items (photos + captions)
  const igGridItems = contents
    .filter((c) => c.instagramCaption)
    .map((c) => ({
      propertyId: c.propertyId,
      caption: c.instagramCaption || "",
      photo: c.property?.leadPhoto || null,
    }));

  return (
    <div className="space-y-5" data-testid="social-feeds-page">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Social Feeds</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            The Italian Exit
          </Badge>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="border rounded-md p-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Content Overview
        </h2>
        {contentLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Posts"
              value={xStats.postsCount + igStats.postsCount}
              icon={FileText}
            />
            <MetricCard
              label="Pending Review"
              value={xStats.pendingCount + igStats.pendingCount}
              icon={RefreshCw}
            />
            <MetricCard
              label="Approved"
              value={xStats.approvedCount + igStats.approvedCount}
              icon={Heart}
            />
            <MetricCard
              label="Published"
              value={xStats.postedCount + igStats.postedCount}
              icon={Users}
            />
          </div>
        )}
      </div>

      {/* Two-column feed layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* X / Twitter */}
        <div className="border rounded-md overflow-hidden">
          <div className="p-3 border-b bg-card">
            <PlatformHeader
              icon={XIcon}
              name="X (Twitter)"
              handle="@TheItalianExit"
              url="https://x.com/TheItalianExit"
            />
            {!contentLoading && (
              <div className="flex gap-3 mt-2">
                <div className="text-xs">
                  <span className="font-medium text-foreground">
                    {xStats.postsCount}
                  </span>{" "}
                  <span className="text-muted-foreground">drafts</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-emerald-600">
                    {xStats.approvedCount}
                  </span>{" "}
                  <span className="text-muted-foreground">approved</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-amber-500">
                    {xStats.pendingCount}
                  </span>{" "}
                  <span className="text-muted-foreground">pending</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-primary">
                    {xStats.postedCount}
                  </span>{" "}
                  <span className="text-muted-foreground">posted</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-card">
            <XTimelineEmbed />
          </div>
        </div>

        {/* Instagram */}
        <div className="border rounded-md overflow-hidden">
          <div className="p-3 border-b bg-card">
            <PlatformHeader
              icon={Instagram}
              name="Instagram"
              handle="@theitalian.exit"
              url="https://www.instagram.com/theitalian.exit/"
            />
            {!contentLoading && (
              <div className="flex gap-3 mt-2">
                <div className="text-xs">
                  <span className="font-medium text-foreground">
                    {igStats.postsCount}
                  </span>{" "}
                  <span className="text-muted-foreground">drafts</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-emerald-600">
                    {igStats.approvedCount}
                  </span>{" "}
                  <span className="text-muted-foreground">approved</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-amber-500">
                    {igStats.pendingCount}
                  </span>{" "}
                  <span className="text-muted-foreground">pending</span>
                </div>
                <div className="text-xs">
                  <span className="font-medium text-primary">
                    {igStats.postedCount}
                  </span>{" "}
                  <span className="text-muted-foreground">posted</span>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 bg-card">
            {contentLoading ? (
              <div className="grid grid-cols-3 gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : (
              <InstagramFeedPreview contents={igGridItems} />
            )}
          </div>
        </div>
      </div>

      {/* Recent Posts Preview Table */}
      <div className="border rounded-md">
        <div className="p-3 border-b">
          <h2 className="text-sm font-medium">Recent Content</h2>
        </div>
        <div className="divide-y">
          {contentLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : contents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No social content generated yet.
            </div>
          ) : (
            contents.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
                data-testid={`recent-content-${c.id}`}
              >
                {c.property?.leadPhoto ? (
                  <img
                    src={c.property.leadPhoto}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-9 h-9 rounded bg-muted shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {c.property?.town}, {c.property?.province}
                  </p>
                  <div className="flex gap-3">
                    {c.twitterPost && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <XIcon className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant={
                              c.twitterStatus === "approved"
                                ? "default"
                                : c.twitterStatus === "posted"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-[10px] h-4 px-1 ${
                              c.twitterStatus === "approved"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : c.twitterStatus === "posted"
                                ? "bg-primary/10 text-primary hover:bg-primary/10"
                                : ""
                            }`}
                          >
                            {c.twitterStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/80 line-clamp-2">
                          {c.twitterPost}
                        </p>
                      </div>
                    )}
                    {c.instagramCaption && (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Instagram className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant={
                              c.instagramStatus === "approved"
                                ? "default"
                                : c.instagramStatus === "posted"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-[10px] h-4 px-1 ${
                              c.instagramStatus === "approved"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : c.instagramStatus === "posted"
                                ? "bg-primary/10 text-primary hover:bg-primary/10"
                                : ""
                            }`}
                          >
                            {c.instagramStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground/80 line-clamp-2">
                          {c.instagramCaption}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
