import express from "express";
import registerRoutes from "./auth/register.js";
import loginRoutes from "./auth/login.js";
import accountRoutes from "./auth/account.js";
import mpinRoutes from "./auth/mpin.js";
import { authMiddleware, publicUser, trackIp, clientIp } from "../utils/authShared.js";

export { authMiddleware, publicUser, trackIp, clientIp };

const router = express.Router();
router.use(registerRoutes);
router.use(loginRoutes);
router.use(accountRoutes);
router.use(mpinRoutes);

export default router;
