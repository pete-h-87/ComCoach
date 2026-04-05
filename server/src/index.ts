import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// TODO: Add PostgreSQL connection and routes here

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
