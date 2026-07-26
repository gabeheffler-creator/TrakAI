import { useState } from "react";

export type WorkoutView = "one-at-a-time" | "list";

const VIEW_KEY = "trak_workout_view";
const PROGRESS_KEY = "trak_show_progress_bar";

function readView(): WorkoutView {
  const v = localStorage.getItem(VIEW_KEY);
  return v === "list" ? "list" : "one-at-a-time";
}

function readProgress(): boolean {
  const v = localStorage.getItem(PROGRESS_KEY);
  return v === "false" ? false : true;
}

export function useWorkoutPrefs() {
  const [workoutView, setWorkoutViewState] = useState<WorkoutView>(readView);
  const [showProgressBar, setShowProgressBarState] = useState<boolean>(readProgress);

  const setWorkoutView = (v: WorkoutView) => {
    localStorage.setItem(VIEW_KEY, v);
    setWorkoutViewState(v);
  };

  const setShowProgressBar = (v: boolean) => {
    localStorage.setItem(PROGRESS_KEY, String(v));
    setShowProgressBarState(v);
  };

  return { workoutView, setWorkoutView, showProgressBar, setShowProgressBar };
}
