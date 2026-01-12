import "dotenv/config";
import express from "express";
import cors from "cors";
import { startMatrix } from "./matrix.js";
import routes from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

startMatrix();

app.listen(4000, "0.0.0.0", () => {
    console.log("Backend running on http://0.0.0.0:4000");
  });
  
