import express from "express";
import { listRooms, getRoomMessages } from "./rooms.controller.js";
import { generateSummary, getSummary } from "./ai.controller.js";

const router = express.Router();

router.get("/rooms", listRooms);
router.get("/rooms/:roomId/messages", getRoomMessages);
router.post("/rooms/:roomId/summarise", generateSummary);
router.get("/rooms/:roomId/summary", getSummary);

export default router;
