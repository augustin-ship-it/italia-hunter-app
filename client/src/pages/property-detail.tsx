import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { PropertyWithSocial, SocialContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";

const fmt = new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const statusBadge: Record<string, string> = {
  qualified: "border-border text-muted-foreground bg-transparent",
  selected: "border-sky-300 text-sky-600 bg-sky-50",
  content_ready: "border-violet-300 text-violet-600 bg-violet-50",
  posted: "border-emerald-300 text-emerald-600 bg-emerald-50",
  rejected: "border-red-300 text-red-500 bg-transparent",
};

/* ── Editable Social Block ── */
function SocialBlock({
  propertyId,
  label,
  platform,
  content,
  status,
}: {
  propertyId: number;
  label: string;
  platform: string;
  content: string | null;
  status: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(content || "");

  const textMutation = useMutation({
    mutationFn: async (newText: string) => {
      await apiRequest("PATCH", `/api/properties/${propertyId}/social/text`, { platform, text: newText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setEditing(false);
      toast({ title: `${label} updated` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/properties/${propertyId}/social/status`, { platform, status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: `${label} status updated` });
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
    return (
      <div className="py-2">
        <h4 className="text-xs font-medium text-muted-foreground mb-1">{label}</h4>
        <p className="text-xs text-muted-foreground">Not generated</p>
      </div>
    );
  }

  return (
    <div className="py-2" data-testid={`social-${platform}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium">{label}</h4>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{status}</Badge>
        </div>
        <div className="flex gap-1">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Copy">
            <Copy className="h-3 w-3" />
          </button>
          {status === "pending" && (
            <>
              <button
                onClick={() => statusMutation.mutate("approved")}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600"
                title="Approve"
              >
                <CheckCircle2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => statusMutation.mutate("rejected")}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500"
                title="Reject"
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
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="text-sm"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-xs" onClick={() => textMutation.mutate(text)} disabled={textMutation.isPending}>Save</Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditing(false); setText(content); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div
          className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/30 rounded p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default function PropertyDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: property, isLoading } = useQuery<PropertyWithSocial>({
    queryKey: [`/api/properties/${id}`],
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Property not found</p>
        <Link href="/properties" className="text-sm text-foreground hover:underline mt-2 inline-block">
          Back to properties
        </Link>
      </div>
    );
  }

  const photos = property.photos || (property.leadPhoto ? [property.leadPhoto] : []);
  const social = property.socialContent;

  const scrollPhotos = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
    }
  };

  const scores = [
    { label: "Composite", value: property.compositeScore },
    { label: "Social Potential", value: property.socialPotentialScore },
    { label: "Value", value: property.valueScore },
    { label: "Location", value: property.locationScore },
    { label: "Character", value: property.characterScore },
    { label: "Sea", value: property.seaScore },
    { label: "Airport", value: property.airportScore },
  ];

  return (
    <div className="space-y-5" data-testid="property-detail-page">
      {/* Back link + header */}
      <div>
        <Link href="/properties" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3 w-3 mr-1" />
          Properties
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{property.town}, {property.province}</h1>
            <p className="text-sm text-muted-foreground">
              {property.region} · {property.propertyType}
              {property.batchDate && <span className="ml-2">· Batch {property.batchDate}</span>}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Badge variant="outline" className={`${statusBadge[property.status] || ""}`}>{property.status}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => statusMutation.mutate("selected")}
              disabled={property.status === "selected"}
              data-testid="detail-select"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Select
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => statusMutation.mutate("rejected")}
              disabled={property.status === "rejected"}
              data-testid="detail-reject"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
            <a href={property.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="detail-external">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Idealista
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Photo gallery — large on top */}
      {photos.length > 0 && (
        <div className="relative" data-testid="photo-gallery">
          <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scroll-smooth pb-1 snap-x" style={{ scrollbarWidth: "none" }}>
            {photos.map((photo, i) => (
              <img
                key={i}
                src={photo}
                alt={`Photo ${i + 1}`}
                className="h-72 rounded object-cover shrink-0 snap-start"
                loading="lazy"
              />
            ))}
          </div>
          {photos.length > 2 && (
            <>
              <button onClick={() => scrollPhotos("left")} className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => scrollPhotos("right")} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 hover:bg-black/60">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Key facts inline */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">{fmt.format(property.price)}</span>
            {property.pricePerSqm && <span className="text-muted-foreground">{fmt.format(property.pricePerSqm)}/m²</span>}
            {property.size && <span className="text-muted-foreground">{property.size} m²</span>}
            {property.rooms && <span className="text-muted-foreground">{property.rooms} rooms</span>}
            {property.bathrooms && <span className="text-muted-foreground">{property.bathrooms} bath</span>}
          </div>

          {/* Score breakdown as table */}
          <div data-testid="score-breakdown">
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Scores</h3>
            <div className="border rounded divide-y">
              {scores.map((s) => (
                <div key={s.label} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={`font-medium ${s.value >= 70 ? "text-foreground" : "text-muted-foreground"}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location details */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Location</h3>
            <div className="text-sm space-y-1">
              {property.address && <p>{property.address}</p>}
              {property.nearestAirport && <p className="text-muted-foreground">{property.nearestAirport} — {property.airportDistanceKm} km</p>}
              {property.distanceToSeaKm != null && <p className="text-muted-foreground">{property.distanceToSeaKm} km to sea</p>}
              {property.latitude && property.longitude && (
                <p className="text-xs text-muted-foreground">{property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{property.description}</p>
            </div>
          )}
        </div>

        {/* Right: social content as editable text areas */}
        <div className="space-y-1" data-testid="social-content">
          <h3 className="text-xs font-medium text-muted-foreground">Social Content</h3>
          {social ? (
            <div className="divide-y">
              {social.summary && (
                <SocialBlock propertyId={id} label="Summary" platform="summary" content={social.summary} status="—" />
              )}
              <SocialBlock propertyId={id} label="Instagram" platform="instagram" content={social.instagramCaption} status={social.instagramStatus as string} />
              <SocialBlock propertyId={id} label="X / Twitter" platform="twitter" content={social.twitterPost} status={social.twitterStatus as string} />
              <SocialBlock propertyId={id} label="Reel Script" platform="reel" content={social.reelScript} status={social.reelStatus as string} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No social content generated yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
