import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw, Zap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SocialContent {
  twitterPost: string | null;
  tweetThread: string[] | null;
  instagramCaption: string | null;
  carouselPhotos: string[] | null;
  twitterPhotos: string[] | null;
}

interface ReviewItem {
  id: number;
  title: string;
  town: string;
  province: string;
  region: string;
  price: number;
  size: number | null;
  rooms: number | null;
  url: string;
  leadPhoto: string | null;
  photos: string[] | null;
  photosCount: number;
  realEstatePornScore: number;
  propertyType: string;
  socialContent: SocialContent | null;
}

function formatPrice(p: number): string {
  if (p >= 1_000_000) return `€${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `€${Math.round(p / 1_000)}K`;
  return `€${p}`;
}

function proxyPhoto(url: string): string {
  if (!url) return url;
  // Apify-signed URLs (s/v1/...) are accessible directly from browser — no proxy needed
  if (url.includes("/s/v1/")) return url;
  // Only proxy unsigned Idealista CDN URLs (hotlink protection)
  if (url.includes("idealista.it") || url.includes("img4.") || url.includes("img3.")) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function PhotoCarousel({ photos, leadPhoto }: { photos: string[] | null; leadPhoto: string | null }) {
  const allPhotos = Array.from(new Set([
    ...(photos || []),
    ...(leadPhoto ? [leadPhoto] : []),
  ])).filter(Boolean).map(proxyPhoto);

  const [idx, setIdx] = useState(0);

  if (allPhotos.length === 0) {
    return (
      <div className="w-full h-52 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm">
        No photos
      </div>
    );
  }

  return (
    <div className="relative w-full h-52 rounded-lg overflow-hidden bg-zinc-900 select-none">
      <img
        src={allPhotos[idx]}
        alt="property"
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {allPhotos.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 rounded-full p-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % allPhotos.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 rounded-full p-1 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {allPhotos.map((_, i) => (
              <span
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-colors ${i === idx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
      <div className="absolute top-2 right-2">
        <Badge variant="secondary" className="bg-black/70 text-white text-xs">
          {allPhotos[idx] && allPhotos[idx].length > 0 ? `${idx + 1}/${allPhotos.length}` : ""}
        </Badge>
      </div>
    </div>
  );
}

function TweetPreview({ thread, twitterPost, propertyId, onEdit }: {
  thread: string[] | null;
  twitterPost: string | null;
  propertyId: number;
  onEdit: (idx: number, text: string) => void;
}) {
  const tweets = thread || (twitterPost ? [twitterPost] : []);
  const [editing, setEditing] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<string[]>(tweets);

  if (tweets.length === 0) return <p className="text-zinc-500 text-sm italic">No tweet generated</p>;

  return (
    <div className="space-y-2">
      {drafts.map((tweet, i) => (
        <div key={i} className="bg-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">
              {tweets.length > 1 ? `Tweet ${i + 1}/${tweets.length}` : "Tweet"}
              {" · "}<span className={tweet.length > 280 ? "text-red-400" : "text-zinc-400"}>{tweet.length}/280</span>
            </span>
          </div>
          {editing === i ? (
            <div className="space-y-2">
              <Textarea
                value={drafts[i]}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = e.target.value;
                  setDrafts(next);
                }}
                className="text-sm bg-zinc-700 border-zinc-600 text-white resize-none min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7"
                  onClick={() => { onEdit(i, drafts[i]); setEditing(null); }}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7"
                  onClick={() => { setDrafts(tweets); setEditing(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-zinc-100 whitespace-pre-wrap cursor-pointer hover:text-white"
              onClick={() => setEditing(i)}
            >
              {tweet}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ item, onAccept, onReject, isAccepting, isRejecting }: {
  item: ReviewItem;
  onAccept: () => void;
  onReject: () => void;
  isAccepting: boolean;
  isRejecting: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const editTweetMutation = useMutation({
    mutationFn: async ({ idx, text }: { idx: number; text: string }) => {
      const res = await apiRequest("PATCH", `/api/review/${item.id}/tweet`, { tweetIndex: idx, text });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/review"] }),
  });

  const photos = item.socialContent?.twitterPhotos || item.socialContent?.carouselPhotos || item.photos;
  const score = item.realEstatePornScore;
  const scoreColor = score >= 70 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-zinc-400";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <PhotoCarousel photos={photos} leadPhoto={item.leadPhoto} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white font-medium text-sm leading-snug line-clamp-1">{item.title}</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {item.town} · {item.region.charAt(0).toUpperCase() + item.region.slice(1).toLowerCase()}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white font-bold text-sm">{formatPrice(item.price)}</p>
            {item.size && <p className="text-zinc-500 text-xs">{item.size}m²</p>}
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Buzz score</span>
          <span className={`text-sm font-bold ${scoreColor}`}>{score}/100</span>
          {score >= 70 && <Badge variant="outline" className="text-xs border-green-700 text-green-400 h-5">Top pick</Badge>}
          {item.photosCount > (photos?.length ?? 0) && (
            <Badge variant="outline" className="text-xs border-amber-700 text-amber-400 h-5">
              {item.photosCount - (photos?.length ?? 0)} more photos on listing
            </Badge>
          )}
        </div>

        {/* Tweet preview */}
        <TweetPreview
          thread={item.socialContent?.tweetThread ?? null}
          twitterPost={item.socialContent?.twitterPost ?? null}
          propertyId={item.id}
          onEdit={(idx, text) => editTweetMutation.mutate({ idx, text })}
        />

        {/* Actions */}
        <div className="flex gap-3 mt-auto pt-2">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium"
            onClick={onAccept}
            disabled={isAccepting || isRejecting}
          >
            {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
            Accept
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={onReject}
            disabled={isAccepting || isRejecting}
          >
            {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1.5" />}
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Review() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<ReviewItem[]>({
    queryKey: ["/api/review"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/review?limit=20");
      return res.json();
    },
    staleTime: 30_000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/review/${id}/accept`);
      return res.json();
    },
    onMutate: (id) => setPendingIds((s) => new Set([...s, id * 10 + 1])),
    onSettled: (_: any, __: any, id: number) => {
      setPendingIds((s) => { const n = new Set(s); n.delete(id * 10 + 1); return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/review"] });
    },
    onSuccess: () => toast({ title: "Queued in Buffer", description: "Thread added to X queue." }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/review/${id}/reject`);
      return res.json();
    },
    onMutate: (id) => setPendingIds((s) => new Set([...s, id * 10 + 2])),
    onSettled: (_: any, __: any, id: number) => {
      setPendingIds((s) => { const n = new Set(s); n.delete(id * 10 + 2); return n; });
      queryClient.invalidateQueries({ queryKey: ["/api/review"] });
    },
    onSuccess: () => toast({ title: "Skipped" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generate", { limit: 20 });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Generating content", description: `${data.generated ?? 0} generated. Refresh in ~30s.` });
      setTimeout(() => refetch(), 35_000);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/review/clear");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Queue cleared", description: `${data.cleared ?? 0} properties reset to qualified.` });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const items = data ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Review Queue</h1>
            <p className="text-zinc-400 text-xs">
              {isLoading ? "Loading..." : `${items.length} pending · Accept → Buffer · Skip → gone`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 h-8 text-xs"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-900 text-red-400 hover:bg-red-950 h-8 text-xs"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 h-8 text-xs"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                : <Zap className="w-3 h-3 mr-1" />}
              Generate
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        )}

        {isError && (
          <div className="text-center py-24 text-zinc-500">
            <p>Failed to load queue.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-24 text-zinc-500">
            <p className="text-lg font-medium text-zinc-400">Queue is empty</p>
            <p className="text-sm mt-1 mb-6">Generate content from qualifying properties in the DB.</p>
            <Button
              className="bg-blue-600 hover:bg-blue-500"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                : <><Zap className="w-4 h-4 mr-2" /> Generate Content</>}
            </Button>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                onAccept={() => acceptMutation.mutate(item.id)}
                onReject={() => rejectMutation.mutate(item.id)}
                isAccepting={pendingIds.has(item.id * 10 + 1)}
                isRejecting={pendingIds.has(item.id * 10 + 2)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
