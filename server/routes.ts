import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { importPropertySchema, propertyStatusEnum, contentApprovalEnum } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

const APP_PASSWORD = process.env.APP_PASSWORD || "ItaliaHunter2026!";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "italia-hunter-secret-key-2026";

function createToken(): string {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): boolean {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return false;
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return false;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

const PIPELINE_API_KEY = process.env.PIPELINE_API_KEY || "italia-pipeline-key-2026";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow pipeline API key for automated imports
  const apiKey = req.headers["x-api-key"] as string || "";
  if (apiKey === PIPELINE_API_KEY) return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!verifyToken(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Auth routes (public)
  app.post("/api/auth/login", async (req, res) => {
    const { password } = req.body || {};
    if (password === APP_PASSWORD) {
      return res.json({ token: createToken() });
    }
    return res.status(401).json({ message: "Invalid password" });
  });

  app.get("/api/auth/verify", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (verifyToken(token)) {
      return res.status(200).json({ valid: true });
    }
    return res.status(401).json({ valid: false });
  });

  // All routes below require auth
  app.use("/api", authMiddleware);

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
        const { propertyId, instagramCaption, twitterPost, reelScript, summary, carouselPhotos } = item;
        if (!propertyId) continue;
        await storage.upsertSocialContent(propertyId, {
          instagramCaption: instagramCaption || null,
          twitterPost: twitterPost || null,
          reelScript: reelScript || null,
          summary: summary || null,
          carouselPhotos: carouselPhotos || null,
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

  // POST /api/buffer/publish — publish content to Buffer (IG or X)
  app.post("/api/buffer/publish", async (req, res) => {
    try {
      const { propertyId, platform } = req.body;
      if (!propertyId || !platform) {
        return res.status(400).json({ message: "propertyId and platform are required" });
      }
      if (!["instagram", "twitter"].includes(platform)) {
        return res.status(400).json({ message: "Platform must be instagram or twitter" });
      }

      // Get property and social content
      const property = await storage.getProperty(propertyId);
      if (!property || !property.socialContent) {
        return res.status(404).json({ message: "Property or social content not found" });
      }
      const social = property.socialContent;

      // Check content is approved
      const statusKey = platform === "instagram" ? "instagramStatus" : "twitterStatus";
      if (social[statusKey] !== "approved") {
        return res.status(400).json({ message: `Content must be approved before publishing. Current status: ${social[statusKey]}` });
      }

      const BUFFER_TOKEN = process.env.BUFFER_TOKEN || "H5wEKXsJAJctr0cTYMDTUs1UbD0zZWUPnfv19IxhRpq";
      const BUFFER_IG_CHANNEL = process.env.BUFFER_IG_CHANNEL || "69b336d87be9f8b1714da537";
      const BUFFER_X_CHANNEL = process.env.BUFFER_X_CHANNEL || "69b337177be9f8b1714da5e4";

      const channelId = platform === "instagram" ? BUFFER_IG_CHANNEL : BUFFER_X_CHANNEL;
      const text = platform === "instagram" ? social.instagramCaption : social.twitterPost;

      if (!text) {
        return res.status(400).json({ message: `No ${platform} content found` });
      }

      // Build assets from carousel photos
      const photos = social.carouselPhotos || [];
      const maxPhotos = platform === "twitter" ? 4 : photos.length;
      const photoUrls = photos.slice(0, maxPhotos);

      const mutation = `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id status text } }
          ... on NotFoundError { message }
          ... on UnauthorizedError { message }
          ... on UnexpectedError { message }
          ... on InvalidInputError { message }
          ... on LimitReachedError { message }
          ... on RestProxyError { message code }
        }
      }`;

      // Helper to attempt Buffer post
      async function attemptBufferPost(withPhotos: string[]) {
        const input: any = { channelId, text, schedulingType: "automatic", mode: "shareNow" };
        if (withPhotos.length > 0) {
          input.assets = { images: withPhotos.map(u => ({ url: u })) };
        }
        if (platform === "instagram") {
          input.metadata = { instagram: { type: withPhotos.length > 1 ? "carousel" : "post", shouldShareToFeed: true } };
        }
        const r = await fetch("https://api.buffer.com/graphql", {
          method: "POST",
          headers: { "Authorization": `Bearer ${BUFFER_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: mutation, variables: { input } }),
        });
        return r.json();
      }

      // Try with photos first, fall back to fewer photos or text-only
      let bufferData: any = await attemptBufferPost(photoUrls);
      if (bufferData.data?.createPost?.message && photoUrls.length > 0) {
        if (photoUrls.length > 1) {
          bufferData = await attemptBufferPost([photoUrls[0]]);
        }
        if (bufferData.data?.createPost?.message && platform === "twitter") {
          bufferData = await attemptBufferPost([]);
        }
      }

      if (bufferData.errors) {
        return res.status(502).json({ message: "Buffer API error", errors: bufferData.errors });
      }
      const result = bufferData.data?.createPost;
      if (result?.post) {
        await storage.updateContentStatus(propertyId, platform, "posted");
        return res.json({ success: true, bufferPostId: result.post.id, status: result.post.status, platform });
      } else {
        return res.status(502).json({ message: result?.message || "Unknown Buffer error" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
