import { useQuery } from "@tanstack/react-query";
import type { Batch, Property } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";

function BatchRow({ batch }: { batch: Batch }) {
  const [expanded, setExpanded] = useState(false);

  const { data: properties } = useQuery<Property[]>({
    queryKey: [`/api/batches/${batch.date}/properties`],
    enabled: expanded,
  });

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
        data-testid={`batch-row-${batch.date}`}
      >
        <TableCell>
          <div className="flex items-center gap-1">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">{batch.date}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant={batch.status === "completed" ? "default" : batch.status === "failed" ? "destructive" : "outline"}
            className={batch.status === "completed" ? "bg-olive" : ""}
          >
            {batch.status}
          </Badge>
        </TableCell>
        <TableCell className="text-right">{batch.rawCount}</TableCell>
        <TableCell className="text-right">{batch.qualifiedCount}</TableCell>
        <TableCell className="text-right">{batch.selectedCount}</TableCell>
        <TableCell className="text-right">{batch.rejectedCount}</TableCell>
      </TableRow>
      {expanded && properties && (
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <div className="bg-muted/30 p-4">
              {properties.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No properties in this batch</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {properties.map((p) => (
                    <Link
                      key={p.id}
                      href={`/properties/${p.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-background/50 transition-colors"
                    >
                      {p.leadPhoto ? (
                        <img src={p.leadPhoto} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.town}</p>
                        <p className="text-xs text-muted-foreground">
                          Score: {p.compositeScore} &middot; {new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function Batches() {
  const { data: batches, isLoading } = useQuery<Batch[]>({
    queryKey: ["/api/batches"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Batch History</h1>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="batches-page">
      <h1 className="text-2xl font-bold">Batch History</h1>

      {!batches || batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No batches yet. Import properties to create the first batch.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Raw</TableHead>
                <TableHead className="text-right">Qualified</TableHead>
                <TableHead className="text-right">Selected</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
