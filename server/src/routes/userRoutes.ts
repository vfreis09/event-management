import { Router } from "express";
import userController from "../controllers/userController";

const router = Router();

router.post("/signup", userController.signup);
router.post("/login", userController.login);
router.get("/user", userController.getUser);
router.post("/logout", userController.logout);
router.post("/reset-password", userController.resetPassword);
router.put("/user/:id", userController.updateUser);

export default router;
