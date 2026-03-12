import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import type { Property, PropertyWithSocial, SocialContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  ArrowUpDown,
  List,
  MapPin,
  Columns,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Twitter,
  Send,
  Pen,
  Copy,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const fmt = new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const statusBadge: Record<string, string> = {
  qualified: "border-border text-muted-foreground bg-transparent",
  selected: "border-sky-300 text-sky-600 bg-sky-50",
  content_ready: "border-violet-300 text-violet-600 bg-violet-50",
  posted: "border-emerald-300 text-emerald-600 bg-emerald-50",
  rejected: "border-red-300 text-red-500 bg-transparent",
};

/* ═══════════════════════════════════════════════════════════════
   TAB 1: RECOMMENDATIONS
   ═══════════════════════════════════════════════════════════════ */

function RecommendationsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ properties: Property[]; total: number }>({
    queryKey: ["/api/properties?minSocialScore=70&status=qualified&sort=-socialPotentialScore&limit=50"],
  });
  const { data: selectedData } = useQuery<{ properties: Property[]; total: number }>({
    queryKey: ["/api/properties?minSocialScore=70&status=selected&sort=-socialPotentialScore&limit=50"],
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

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  const qualified = data?.properties || [];
  const selected = selectedData?.properties || [];
  const all = [...qualified, ...selected].sort((a, b) => b.socialPotentialScore - a.socialPotentialScore);

  if (all.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No high-potential properties to review right now.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="recommendations-tab">
      <div className="text-xs text-muted-foreground mb-2">
        {all.length} properties with social potential score &ge; 70
      </div>
      <div className="border rounded divide-y">
        {all.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors"
            data-testid={`rec-property-${p.id}`}
          >
            <Link href={`/properties/${p.id}`}>
              {p.leadPhoto ? (
                <img src={p.leadPhoto} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/properties/${p.id}`} className="hover:underline">
                  <span className="text-sm font-medium truncate block">{p.town}, {p.province}</span>
                </Link>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize shrink-0">
                  {p.propertyType}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${statusBadge[p.status] || ""}`}>
                  {p.status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                <span>{fmt.format(p.price)}</span>
                {p.size && <span>{p.size} m²</span>}
                <span>{p.region}</span>
                <span>Score {p.compositeScore}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-amber-500 shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
              {p.socialPotentialScore}
            </span>
            <div className="flex gap-0.5 shrink-0">
              {p.status === "qualified" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={() => statusMutation.mutate({ id: p.id, status: "selected" })}
                  data-testid={`rec-select-${p.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Select
                </Button>
              )}
              {p.status === "qualified" && (
                <button
                  onClick={() => statusMutation.mutate({ id: p.id, status: "rejected" })}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors"
                  data-testid={`rec-skip-${p.id}`}
                  title="Skip"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
              {p.status === "selected" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-sky-300 text-sky-600 bg-sky-50">
                  Selected
                </Badge>
              )}
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Idealista"
                data-testid={`rec-link-${p.id}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: FULL LISTING
   ═══════════════════════════════════════════════════════════════ */

/* ── Map View ── */
function PropertyMap({
  properties,
  onStatusChange,
  height = "h-[600px]",
}: {
  properties: Property[];
  onStatusChange: (id: number, status: string) => void;
  height?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const initMap = async () => {
      const L = await import("leaflet");
      leafletRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });
      const map = L.map(mapRef.current!, { center: [41.5, 14.5], zoom: 6, zoomControl: true });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    };
    initMap();
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    markersRef.current.forEach((m: any) => m.remove());
    markersRef.current = [];
    const withCoords = properties.filter((p) => p.latitude && p.longitude);
    withCoords.forEach((p) => {
      const color = p.compositeScore >= 80 ? "#5B7B3E" : p.compositeScore >= 60 ? "#d97706" : "#B8654A";
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:600;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;cursor:pointer;">${p.compositeScore}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([p.latitude!, p.longitude!], { icon }).addTo(map);
      marker.on("click", () => setSelectedProperty(p));
      markersRef.current.push(marker);
    });
    if (withCoords.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1), { maxZoom: 10 });
    }
  }, [properties, mapReady]);

  return (
    <div className="relative" data-testid="property-map">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} className={`w-full ${height} rounded border overflow-hidden`} />
      {selectedProperty && (
        <div className="absolute bottom-3 left-3 right-3 max-w-sm z-[1000]" data-testid="map-popup">
          <div className="bg-card border rounded p-3">
            <div className="flex gap-2.5">
              {selectedProperty.leadPhoto && (
                <Link href={`/properties/${selectedProperty.id}`}>
                  <img src={selectedProperty.leadPhoto} alt="" className="w-16 h-12 rounded object-cover shrink-0" />
                </Link>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <Link href={`/properties/${selectedProperty.id}`} className="hover:underline">
                    <p className="text-sm font-medium truncate">{selectedProperty.town}, {selectedProperty.province}</p>
                  </Link>
                  <button onClick={() => setSelectedProperty(null)} className="p-0.5 rounded hover:bg-accent text-muted-foreground shrink-0">
                    <XCircle className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{selectedProperty.region}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium">{fmt.format(selectedProperty.price)}</span>
                  <span className="text-xs text-muted-foreground">{selectedProperty.compositeScore}</span>
                </div>
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => { onStatusChange(selectedProperty.id, "selected"); setSelectedProperty(null); }}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600"
                    data-testid={`map-select-${selectedProperty.id}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { onStatusChange(selectedProperty.id, "rejected"); setSelectedProperty(null); }}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500"
                    data-testid={`map-reject-${selectedProperty.id}`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                  <a href={selectedProperty.url} target="_blank" rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Table ── */
function PropertiesTable({
  properties,
  onStatusChange,
}: {
  properties: Property[];
  onStatusChange: (id: number, status: string) => void;
}) {
  return (
    <div className="border rounded divide-y" data-testid="properties-table">
      <div className="hidden sm:grid grid-cols-[48px_1fr_80px_80px_90px_80px_60px_50px_80px] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium bg-muted/30">
        <span />
        <span>Location</span>
        <span>Region</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Size</span>
        <span className="text-center">Score</span>
        <span className="text-center">Social</span>
        <span className="text-right">Actions</span>
      </div>
      {properties.map((p) => (
        <div
          key={p.id}
          className="grid grid-cols-[48px_1fr_auto] sm:grid-cols-[48px_1fr_80px_80px_90px_80px_60px_50px_80px] gap-2 px-3 py-2 items-center hover:bg-accent/30 transition-colors"
          data-testid={`property-row-${p.id}`}
        >
          <Link href={`/properties/${p.id}`}>
            {p.leadPhoto ? (
              <img src={p.leadPhoto} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted" />
            )}
          </Link>
          <div className="min-w-0">
            <Link href={`/properties/${p.id}`} className="hover:underline">
              <span className="text-sm font-medium truncate block">{p.town}, {p.province}</span>
            </Link>
            <div className="flex items-center gap-2 sm:hidden text-xs text-muted-foreground">
              <span>{p.region}</span>
              <span>{fmt.format(p.price)}</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusBadge[p.status] || ""}`}>{p.status}</Badge>
            </div>
          </div>
          <span className="hidden sm:block text-xs text-muted-foreground truncate">{p.region}</span>
          <span className="hidden sm:block text-xs text-muted-foreground truncate">{p.propertyType}</span>
          <span className="hidden sm:block text-sm font-medium text-right">{fmt.format(p.price)}</span>
          <span className="hidden sm:block text-xs text-muted-foreground text-right">{p.size ? `${p.size} m²` : "—"}</span>
          <span className="hidden sm:block text-xs font-medium text-center">{p.compositeScore}</span>
          <span className={`hidden sm:flex items-center justify-center gap-0.5 text-xs ${p.socialPotentialScore >= 70 ? "font-medium text-amber-500" : "text-muted-foreground"}`}>
            {p.socialPotentialScore >= 70 && <Sparkles className="h-2.5 w-2.5" />}
            {p.socialPotentialScore}
          </span>
          <div className="flex gap-0.5 justify-end">
            <Badge variant="outline" className={`hidden sm:inline-flex text-[10px] px-1.5 py-0 h-4 mr-1 ${statusBadge[p.status] || ""}`}>{p.status}</Badge>
            <button
              onClick={() => onStatusChange(p.id, "selected")}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600 transition-colors"
              data-testid={`select-${p.id}`}
              title="Select"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onStatusChange(p.id, "rejected")}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors"
              data-testid={`reject-${p.id}`}
              title="Reject"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Idealista"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 50;

function FullListingTab() {
  const [view, setView] = useState<"list" | "map" | "split">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("-compositeScore");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [statusFilter, regionFilter, minPrice, maxPrice, sortBy]);

  const queryParams = new URLSearchParams();
  queryParams.set("status", statusFilter);
  queryParams.set("sort", sortBy);
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String((page - 1) * PAGE_SIZE));
  if (regionFilter !== "all") queryParams.set("region", regionFilter);
  if (minPrice) queryParams.set("minPrice", minPrice);
  if (maxPrice) queryParams.set("maxPrice", maxPrice);

  const queryKey = `/api/properties?${queryParams.toString()}`;

  const { data, isLoading } = useQuery<{ properties: Property[]; total: number }>({
    queryKey: [queryKey],
  });

  const { data: allData } = useQuery<{ properties: Property[]; total: number }>({
    queryKey: ["/api/properties?status=all&limit=1000"],
  });

  const regions = allData
    ? [...new Set(allData.properties.map((p) => p.region))].sort()
    : [];

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

  const handleStatusChange = (id: number, status: string) => {
    statusMutation.mutate({ id, status });
  };

  const properties = data?.properties || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-3" data-testid="full-listing-tab">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 w-[110px] text-xs" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="content_ready">Content Ready</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="h-7 w-[110px] text-xs" data-testid="filter-region">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input type="number" placeholder="Min €" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-7 w-[80px] text-xs" data-testid="filter-min-price" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="number" placeholder="Max €" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-7 w-[80px] text-xs" data-testid="filter-max-price" />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 w-[140px] text-xs" data-testid="sort-by">
            <ArrowUpDown className="h-3 w-3 mr-1 shrink-0" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-compositeScore">Score ↓</SelectItem>
            <SelectItem value="-socialPotentialScore">Social ↓</SelectItem>
            <SelectItem value="-price">Price ↓</SelectItem>
            <SelectItem value="price">Price ↑</SelectItem>
            <SelectItem value="-valueScore">Value ↓</SelectItem>
            <SelectItem value="-characterScore">Character ↓</SelectItem>
            <SelectItem value="-locationScore">Location ↓</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">{total} results</span>

        <div className="flex gap-0.5">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setView("list")} data-testid="view-list">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant={view === "map" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setView("map")} data-testid="view-map">
            <MapPin className="h-3.5 w-3.5" />
          </Button>
          <Button variant={view === "split" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setView("split")} data-testid="view-split">
            <Columns className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : properties.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No properties found. Adjust filters or import data.</div>
      ) : view === "map" ? (
        <PropertyMap properties={properties} onStatusChange={handleStatusChange} />
      ) : view === "split" ? (
        <div className="flex gap-3 min-h-[600px]" data-testid="split-view">
          <div className="w-1/2 overflow-y-auto max-h-[700px]">
            <PropertiesTable properties={properties} onStatusChange={handleStatusChange} />
          </div>
          <div className="w-1/2">
            <PropertyMap properties={properties} onStatusChange={handleStatusChange} height="h-full min-h-[600px]" />
          </div>
        </div>
      ) : (
        <PropertiesTable properties={properties} onStatusChange={handleStatusChange} />
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2" data-testid="pagination">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="page-prev">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
              <Button key={p} variant={p === page ? "secondary" : "ghost"} size="sm" className="h-7 min-w-[28px] p-0 text-xs" onClick={() => setPage(p)} data-testid={`page-${p}`}>
                {p}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)} data-testid="page-next">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3: PUBLISH QUEUE
   ═══════════════════════════════════════════════════════════════ */

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
      <div ref={trackRef} className="flex overflow-hidden rounded-lg snap-x snap-mandatory" style={{ scrollSnapType: "x mandatory" }}>
        {photos.map((url, i) => (
          <div key={i} className="snap-center shrink-0 w-full aspect-[4/3] bg-muted">
            <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" loading={i < 2 ? "eager" : "lazy"} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button onClick={() => setCurrent(Math.max(0, current - 1))} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0" disabled={current === 0} data-testid="carousel-prev">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setCurrent(Math.min(photos.length - 1, current + 1))} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0" disabled={current === photos.length - 1} data-testid="carousel-next">
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
        {photos.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all ${i === current ? "w-3 bg-white" : "w-1.5 bg-white/50"}`} />
        ))}
      </div>
      <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded-full">{current + 1}/{photos.length}</span>
    </div>
  );
}

/* ── Platform Content Block ── */
function PlatformBlock({ propertyId, platform, social }: { propertyId: number; platform: Platform; social: SocialContent }) {
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
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: `${meta.label} status updated` }); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const textMutation = useMutation({
    mutationFn: async (text: string) => {
      await apiRequest("PATCH", `/api/properties/${propertyId}/social/text`, { platform, text });
    },
    onSuccess: () => { queryClient.invalidateQueries(); setEditing(false); toast({ title: `${meta.label} updated` }); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Icon className="h-3.5 w-3.5" />
        <span>Not generated</span>
      </div>
    );
  }

  return (
    <div data-testid={`platform-${platform}-${propertyId}`} className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        <span className="text-xs font-medium">{meta.label}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusStyles[status] || ""}`}>{status}</Badge>
        <div className="flex gap-0.5 ml-auto">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Copy"><Copy className="h-3 w-3" /></button>
          {status === "pending" && (
            <>
              <button onClick={() => setEditing(!editing)} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Edit" data-testid={`edit-${platform}-${propertyId}`}><Pen className="h-3 w-3" /></button>
              <button onClick={() => statusMutation.mutate("approved")} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-600" title="Approve" data-testid={`approve-${platform}-${propertyId}`}><CheckCircle2 className="h-3 w-3" /></button>
              <button onClick={() => statusMutation.mutate("rejected")} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-500" title="Reject" data-testid={`reject-${platform}-${propertyId}`}><XCircle className="h-3 w-3" /></button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={6} className="text-xs font-mono" data-testid={`textarea-${platform}-${propertyId}`} />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[10px] px-2.5" onClick={() => textMutation.mutate(editText)} disabled={textMutation.isPending}>Save</Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2.5" onClick={() => { setEditing(false); setEditText(content); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 max-h-44 overflow-y-auto border border-border/30">{content}</div>
      )}
      {!editing && (
        <div className="text-[10px] text-muted-foreground">
          {content.length} characters
          {platform === "twitter" && content.length > 280 && <span className="text-red-500 ml-1">(over 280 limit)</span>}
        </div>
      )}
    </div>
  );
}

/* ── Publish Queue Content Card ── */
function PublishQueueCard({ property, section }: { property: PropertyWithSocial; section: "pending" | "ready" | "published" }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(section === "pending");
  const social = property.socialContent;
  if (!social) return null;

  const platforms: Platform[] = ["instagram", "twitter"];
  const photos = social.carouselPhotos || [];

  const publishMutation = useMutation({
    mutationFn: async ({ platform }: { platform: Platform }) => {
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
    <div className="border rounded-lg overflow-hidden" data-testid={`content-card-${property.id}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        {property.leadPhoto && <img src={property.leadPhoto} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{property.town}, {property.province}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 capitalize">{property.propertyType}</Badge>
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
              <Sparkles className="h-3 w-3" />{property.socialPotentialScore}
            </span>
          )}
          <div className="flex gap-1">
            {platforms.map((p) => {
              const s = social[platformMeta[p].statusKey] as string;
              return (
                <div key={p} className={`h-2 w-2 rounded-full ${s === "approved" || s === "posted" ? "bg-emerald-500" : s === "rejected" ? "bg-red-500" : "bg-amber-400"}`} title={`${platformMeta[p].label}: ${s}`} />
              );
            })}
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {photos.length > 0 && (
              <div className="p-3 lg:border-r border-b lg:border-b-0">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Carousel Preview ({photos.length} photos)</div>
                <CarouselPreview photos={photos} />
              </div>
            )}
            <div className="p-3">
              <Tabs defaultValue="instagram">
                <TabsList className="h-7 mb-3">
                  <TabsTrigger value="instagram" className="text-[11px] h-6 px-2.5 gap-1"><Instagram className="h-3 w-3" /> IG</TabsTrigger>
                  <TabsTrigger value="twitter" className="text-[11px] h-6 px-2.5 gap-1"><Twitter className="h-3 w-3" /> X</TabsTrigger>
                </TabsList>
                {platforms.map((platform) => (
                  <TabsContent key={platform} value={platform} className="mt-0">
                    <PlatformBlock propertyId={property.id} platform={platform} social={social} />
                    {platform === "instagram" && social.instagramFirstComment && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">First comment (hashtags)</div>
                        <div className="text-xs bg-muted/30 rounded-lg p-2 border border-border/30 text-muted-foreground">{social.instagramFirstComment}</div>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>

          {/* Action bar */}
          <div className="border-t px-3 py-2 flex items-center gap-2 bg-muted/20">
            <a href={property.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <ExternalLink className="h-3 w-3" /> Idealista
            </a>
            <Link href={`/properties/${property.id}`} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <Eye className="h-3 w-3" /> Detail
            </Link>
            <div className="ml-auto flex gap-1.5">
              {social.instagramStatus === "approved" && (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 border-pink-200 text-pink-600 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-400 dark:hover:bg-pink-950/30" onClick={() => publishMutation.mutate({ platform: "instagram" })} disabled={publishMutation.isPending} data-testid={`publish-ig-${property.id}`}>
                  <Send className="h-3 w-3" /> {publishMutation.isPending && publishMutation.variables?.platform === "instagram" ? "..." : "Publish IG"}
                </Button>
              )}
              {social.instagramStatus === "posted" && (
                <Badge variant="outline" className="h-6 text-[10px] px-2 gap-1 border-pink-200/60 text-pink-500 bg-pink-50/50"><CheckCircle2 className="h-3 w-3" /> IG posted</Badge>
              )}
              {social.twitterStatus === "approved" && (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950/30" onClick={() => publishMutation.mutate({ platform: "twitter" })} disabled={publishMutation.isPending} data-testid={`publish-x-${property.id}`}>
                  <Send className="h-3 w-3" /> {publishMutation.isPending && publishMutation.variables?.platform === "twitter" ? "..." : "Publish X"}
                </Button>
              )}
              {social.twitterStatus === "posted" && (
                <Badge variant="outline" className="h-6 text-[10px] px-2 gap-1 border-sky-200/60 text-sky-500 bg-sky-50/50"><CheckCircle2 className="h-3 w-3" /> X posted</Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PublishQueueTab() {
  const { data: queue, isLoading } = useQuery<PropertyWithSocial[]>({
    queryKey: ["/api/content-queue"],
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>;
  }

  const items = queue || [];

  const pending = items.filter((p) => {
    const s = p.socialContent;
    return s && (s.instagramStatus === "pending" || s.twitterStatus === "pending");
  });
  const ready = items.filter((p) => {
    const s = p.socialContent;
    return s && s.instagramStatus === "approved" && s.twitterStatus === "approved";
  });
  const published = items.filter((p) => {
    const s = p.socialContent;
    return s && s.instagramStatus === "posted" && s.twitterStatus === "posted";
  });
  // Partially approved (one platform approved but not both, and not fully published)
  const partiallyApproved = items.filter((p) => {
    const s = p.socialContent;
    if (!s) return false;
    const ig = s.instagramStatus as string;
    const tw = s.twitterStatus as string;
    const bothApproved = ig === "approved" && tw === "approved";
    const bothPosted = ig === "posted" && tw === "posted";
    const hasPending = ig === "pending" || tw === "pending";
    return !bothApproved && !bothPosted && !hasPending && (ig === "approved" || tw === "approved");
  });

  return (
    <div className="space-y-5" data-testid="publish-queue-tab">
      {items.length === 0 && (
        <div className="py-16 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No content in queue</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Select properties from Recommendations to generate content.</p>
        </div>
      )}

      {/* Pending Review */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Pending Review ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((p) => <PublishQueueCard key={p.id} property={p} section="pending" />)}
          </div>
        </div>
      )}

      {/* Partially approved */}
      {partiallyApproved.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Partially Approved ({partiallyApproved.length})
          </h3>
          <div className="space-y-2">
            {partiallyApproved.map((p) => <PublishQueueCard key={p.id} property={p} section="ready" />)}
          </div>
        </div>
      )}

      {/* Ready to Publish */}
      {ready.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Ready to Publish ({ready.length})
          </h3>
          <div className="space-y-2">
            {ready.map((p) => <PublishQueueCard key={p.id} property={p} section="ready" />)}
          </div>
        </div>
      )}

      {/* Published */}
      {published.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Published ({published.length})
          </h3>
          <div className="space-y-2">
            {published.map((p) => <PublishQueueCard key={p.id} property={p} section="published" />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — 3 TABS
   ═══════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  return (
    <div data-testid="dashboard-page">
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList className="h-8" data-testid="main-tabs">
          <TabsTrigger value="recommendations" className="text-xs h-7 px-3" data-testid="tab-recommendations">
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="listing" className="text-xs h-7 px-3" data-testid="tab-listing">
            Full Listing
          </TabsTrigger>
          <TabsTrigger value="publish" className="text-xs h-7 px-3" data-testid="tab-publish">
            Publish Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-0">
          <RecommendationsTab />
        </TabsContent>

        <TabsContent value="listing" className="mt-0">
          <FullListingTab />
        </TabsContent>

        <TabsContent value="publish" className="mt-0">
          <PublishQueueTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
