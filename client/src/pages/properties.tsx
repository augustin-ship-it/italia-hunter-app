import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import type { Property } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, List, ExternalLink, Sparkles, ArrowUpDown, MapPin, Columns, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusBadge: Record<string, string> = {
  qualified: "border-border text-muted-foreground bg-transparent",
  selected: "border-sky-300 text-sky-600 bg-sky-50",
  content_ready: "border-violet-300 text-violet-600 bg-violet-50",
  posted: "border-emerald-300 text-emerald-600 bg-emerald-50",
  rejected: "border-red-300 text-red-500 bg-transparent",
};

const fmt = new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ── Map View Component ── */
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
      // Light tile layer
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

/* ── Properties List Table ── */
function PropertiesTable({
  properties,
  onStatusChange,
}: {
  properties: Property[];
  onStatusChange: (id: number, status: string) => void;
}) {
  return (
    <div className="border rounded divide-y" data-testid="properties-table">
      {/* Header */}
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
          {/* Thumbnail */}
          <Link href={`/properties/${p.id}`}>
            {p.leadPhoto ? (
              <img src={p.leadPhoto} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted" />
            )}
          </Link>
          {/* Location */}
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
          {/* Region */}
          <span className="hidden sm:block text-xs text-muted-foreground truncate">{p.region}</span>
          {/* Type */}
          <span className="hidden sm:block text-xs text-muted-foreground truncate">{p.propertyType}</span>
          {/* Price */}
          <span className="hidden sm:block text-sm font-medium text-right">{fmt.format(p.price)}</span>
          {/* Size */}
          <span className="hidden sm:block text-xs text-muted-foreground text-right">{p.size ? `${p.size} m²` : "—"}</span>
          {/* Score */}
          <span className="hidden sm:block text-xs font-medium text-center">{p.compositeScore}</span>
          {/* Social */}
          <span className={`hidden sm:flex items-center justify-center gap-0.5 text-xs ${p.socialPotentialScore >= 70 ? "font-medium text-amber-500" : "text-muted-foreground"}`}>
            {p.socialPotentialScore >= 70 && <Sparkles className="h-2.5 w-2.5" />}
            {p.socialPotentialScore}
          </span>
          {/* Actions */}
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
              title="Open on Idealista"
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

/* ── Main Properties Page ── */
export default function Properties() {
  const [view, setView] = useState<"list" | "map" | "split">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("-compositeScore");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  // Reset page when filters change
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
    <div className="space-y-3" data-testid="properties-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Properties</h1>
        <span className="text-xs text-muted-foreground">{total} results</span>
      </div>

      {/* Compact filter bar */}
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
          <Input
            type="number"
            placeholder="Min €"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="h-7 w-[80px] text-xs"
            data-testid="filter-min-price"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="Max €"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-7 w-[80px] text-xs"
            data-testid="filter-max-price"
          />
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

        <div className="flex gap-0.5 ml-auto">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView("list")}
            data-testid="view-list"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "map" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView("map")}
            data-testid="view-map"
          >
            <MapPin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "split" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView("split")}
            data-testid="view-split"
          >
            <Columns className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No properties found. Adjust filters or import data.
        </div>
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="page-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? "secondary" : "ghost"}
                size="sm"
                className="h-7 min-w-[28px] p-0 text-xs"
                onClick={() => setPage(p)}
                data-testid={`page-${p}`}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= Math.ceil(total / PAGE_SIZE)}
              onClick={() => setPage((p) => p + 1)}
              data-testid="page-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
