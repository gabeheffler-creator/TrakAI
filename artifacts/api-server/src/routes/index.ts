import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import exercisesRouter from "./exercises";
import programsRouter from "./programs";
import workoutLogsRouter from "./workout_logs";
import measurementsRouter from "./measurements";
import sleepLogsRouter from "./sleep_logs";
import nutritionLogsRouter from "./nutrition_logs";
import progressPhotosRouter from "./progress_photos";
import assignmentsRouter from "./assignments";
import messagesRouter from "./messages";
import dashboardRouter from "./dashboard";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(exercisesRouter);
router.use(programsRouter);
router.use(workoutLogsRouter);
router.use(measurementsRouter);
router.use(sleepLogsRouter);
router.use(nutritionLogsRouter);
router.use(progressPhotosRouter);
router.use(assignmentsRouter);
router.use(messagesRouter);
router.use(dashboardRouter);
router.use(uploadRouter);

export default router;
