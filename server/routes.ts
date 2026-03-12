import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { importPropertySchema, propertyStatusEnum, contentApprovalEnum } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // GET /api/properties — list with filters
  app.get("/api/properties", async (req, res) => {
    try {
      const filters = {
        region: req.query.region as string | undefined,
        status: req.query.status as string | undefined,
        minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
        maxScore: req.query.maxScore ? Number(req.query.maxScore) : undefined,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        minSocialScore: req.query.minSocialScore ? Number(req.query.minSocialScore) : undefined,
        maxSocialScore: req.query.maxSocialScore ? Number(req.query.maxSocialScore) : undefined,
        batchDate: req.query.batchDate as string | undefined,
        sort: req.query.sort as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      };
      const result = await storage.getProperties(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/properties/:id — single property with social content
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/properties/:id/status — update status
  app.patch("/api/properties/:id/status", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      const parsed = propertyStatusEnum.safeParse(status);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status. Must be: qualified, selected, rejected, emailed, content_ready, or posted" });
      }
      const property = await storage.updatePropertyStatus(id, parsed.data);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/properties/import — bulk import from pipeline
  app.post("/api/properties/import", async (req, res) => {
    try {
      const body = req.body;
      if (!Array.isArray(body)) {
        return res.status(400).json({ message: "Request body must be an array of properties" });
      }
      const parsed = z.array(importPropertySchema).safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.errors.slice(0, 10),
        });
      }
      const result = await storage.importProperties(parsed.data);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/properties/:id/social — get social content
  app.get("/api/properties/:id/social", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const social = await storage.getSocialContent(id);
      if (!social) {
        return res.status(404).json({ message: "Social content not found" });
      }
      res.json(social);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/properties/:id/social/status — update content approval status per platform
  app.patch("/api/properties/:id/social/status", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { platform, status } = req.body;
      if (!["instagram", "twitter", "reel"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform. Must be: instagram, twitter, or reel" });
      }
      const parsed = contentApprovalEnum.safeParse(status);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid status. Must be: pending, approved, rejected, or posted" });
      }
      const social = await storage.updateContentStatus(id, platform, parsed.data);
      if (!social) {
        return res.status(404).json({ message: "Social content not found" });
      }
      res.json(social);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/properties/:id/social/text — update content text per platform
  app.patch("/api/properties/:id/social/text", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { platform, text } = req.body;
      if (!["instagram", "twitter", "reel"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform. Must be: instagram, twitter, or reel" });
      }
      if (typeof text !== "string") {
        return res.status(400).json({ message: "Text must be a string" });
      }
      const social = await storage.updateContentText(id, platform, text);
      if (!social) {
        return res.status(404).json({ message: "Social content not found" });
      }
      res.json(social);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/content-queue — properties with content ready for review
  app.get("/api/content-queue", async (_req, res) => {
    try {
      const queue = await storage.getContentQueue();
      res.json(queue);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/batches — list all batches
  app.get("/api/batches", async (_req, res) => {
    try {
      const batches = await storage.getBatches();
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/batches — create a new batch
  app.post("/api/batches", async (req, res) => {
    try {
      const batch = await storage.createBatch(req.body);
      res.status(201).json(batch);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/batches/:date/properties — properties from a specific batch
  app.get("/api/batches/:date/properties", async (req, res) => {
    try {
      const properties = await storage.getBatchProperties(req.params.date);
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/social/bulk — bulk import social content
  app.post("/api/social/bulk", async (req, res) => {
    try {
      const items = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ message: "Body must be an array" });
      }
      let imported = 0;
      for (const item of items) {
        const { propertyId, instagramCaption, twitterPost, reelScript, summary } = item;
        if (!propertyId) continue;
        await storage.upsertSocialContent(propertyId, {
          instagramCaption: instagramCaption || null,
          twitterPost: twitterPost || null,
          reelScript: reelScript || null,
          summary: summary || null,
        });
        imported++;
      }
      res.json({ imported });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/social/contents — all social contents with property info
  app.get("/api/social/contents", async (_req, res) => {
    try {
      const contents = await storage.getAllSocialContents();
      res.json({ contents });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/stats — dashboard summary stats
  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
