import { useState } from "react";

export type WorkoutView = "one-at-a-time" | "list";
export type ProgressMode = "bar" | "ratio";

const VIEW_KEY = "trak_workout_view";
const PROGRESS_KEY = "trak_show_progress_bar";
const PROGRESS_MODE_KEY = "trak_progress_mode";

function readView(): WorkoutView {
  const v = localStorage.getItem(VIEW_KEY);
  return v === "list" ? "list" : "one-at-a-time";
}

function readProgress(): boolean {
  const v = localStorage.getItem(PROGRESS_KEY);
  return v === "false" ? false : true;
}

function readProgressMode(): ProgressMode {
  const v = localStorage.getItem(PROGRESS_MODE_KEY);
  return v === "ratio" ? "ratio" : "bar";
}

export function useWorkoutPrefs() {
  const [workoutView, setWorkoutViewState] = useState<WorkoutView>(readView);
  const [showProgressBar, setShowProgressBarState] = useState<boolean>(readProgress);
  const [progressMode, setProgressModeState] = useState<ProgressMode>(readProgressMode);

  const setWorkoutView = (v: WorkoutView) => {
    localStorage.setItem(VIEW_KEY, v);
    setWorkoutViewState(v);
  };

  const setShowProgressBar = (v: boolean) => {
    localStorage.setItem(PROGRESS_KEY, String(v));
    setShowProgressBarState(v);
  };

  const setProgressMode = (v: ProgressMode) => {
    localStorage.setItem(PROGRESS_MODE_KEY, v);
    setProgressModeState(v);
  };

  return { workoutView, setWorkoutView, showProgressBar, setShowProgressBar, progressMode, setProgressMode };
}
