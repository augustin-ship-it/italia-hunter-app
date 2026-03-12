/**
 * Vercel serverless entry point.
 * Exports the Express app as a request handler (no .listen()).
 */
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Register API routes synchronously via top-level await
await registerRoutes(httpServer, app);

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  if (res.headersSent) return next(err);
  return res.status(status).json({ message });
});

// Export for Vercel serverless
export default app;
