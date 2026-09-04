import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalBurstLimit } from "./lib/rate-limit";
import { PgSessionStore } from "./lib/pg-session-store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
app.set("trust proxy", 1);
if (process.env.NODE_ENV === "production" && !process.env.AUTH_PUBLIC_BASE_URL) {
  throw new Error("AUTH_PUBLIC_BASE_URL must be set in production");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const webAllowedOrigins = (process.env.WEB_ALLOWED_ORIGINS ?? "")
  .split(",").map(origin => origin.trim()).filter(Boolean);
const nativeAllowedOrigins = ["capacitor://localhost"];
const corsAllowedOrigins = [...webAllowedOrigins, ...nativeAllowedOrigins];
const nativeCredentialPaths = new Set([
  "/api/auth/token/login",
  "/api/auth/token/refresh",
  "/api/auth/token/revoke",
]);

// Cookies are sent automatically by browsers: reject unsafe cross-origin
// mutations. Native origins are CORS-enabled for bearer auth, but are not
// trusted to submit cookie-authenticated mutations.
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.get("authorization")) {
    const origin = req.get("origin");
    const trustedSelf = `${req.protocol}://${req.get("host")}`;
    const nativeBodyCredentialRequest = !!origin
      && nativeAllowedOrigins.includes(origin)
      && nativeCredentialPaths.has(req.path);
    if (nativeBodyCredentialRequest) {
      next();
      return;
    }
    if (origin && origin !== trustedSelf && !webAllowedOrigins.includes(origin)) {
      res.status(403).json({ error: "Cross-origin cookie request rejected" });
      return;
    }
  }
  next();
});

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    // no Origin is same-origin/non-browser traffic; never reflect arbitrary origins.
    if (!origin || corsAllowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    name: "trak_session",
    secret: process.env.SESSION_SECRET ?? (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("SESSION_SECRET must be set in production"); })()
      : "development-session-secret-not-for-production"),
    store: new PgSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

const assetsDir = path.resolve(__dirname, "../../../attached_assets");
app.use("/api/assets", express.static(assetsDir));

app.use("/api", generalBurstLimit);
app.use("/api", router);

export default app;
