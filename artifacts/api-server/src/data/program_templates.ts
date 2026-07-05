export interface TemplateExercise {
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
}

export interface TemplateDay {
  dayNumber: number;
  name: string;
  notes?: string;
  exercises: TemplateExercise[];
}

export interface TemplatePhase {
  name: string;
  durationWeeks: number;
  daysPerWeek: number;
  days: TemplateDay[];
}

export interface ProgramTemplate {
  key: string;
  name: string;
  description: string;
  focus: string;
  durationWeeks: number;
  phases: TemplatePhase[];
}

function ex(exerciseName: string, muscleGroup: string, sets: number, reps: string, restSeconds?: number, notes?: string): TemplateExercise {
  return { exerciseName, muscleGroup, sets, reps, restSeconds, notes };
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    key: "strength",
    name: "Strength Builder",
    description: "A 12-week upper/lower strength program built around progressive overload on the big compound lifts.",
    focus: "Strength",
    durationWeeks: 12,
    phases: [
      {
        name: "Foundation",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper A", exercises: [
              ex("Barbell Bench Press", "Chest", 4, "6", 150),
              ex("Barbell Row", "Back", 4, "6", 120),
              ex("Overhead Press", "Shoulders", 3, "8", 120),
              ex("Lat Pulldown", "Back", 3, "8", 90),
              ex("Tricep Pushdown", "Triceps", 3, "10", 60),
              ex("Barbell Curl", "Biceps", 3, "10", 60),
            ],
          },
          {
            dayNumber: 2, name: "Lower A", exercises: [
              ex("Back Squat", "Legs", 4, "6", 150),
              ex("Romanian Deadlift", "Legs", 3, "8", 120),
              ex("Leg Press", "Legs", 3, "10", 90),
              ex("Leg Curl", "Legs", 3, "10", 60),
              ex("Calf Raise", "Legs", 4, "12", 60),
            ],
          },
          {
            dayNumber: 3, name: "Upper B", exercises: [
              ex("Incline Barbell Bench Press", "Chest", 4, "6", 150),
              ex("T-Bar Row", "Back", 4, "6", 120),
              ex("Arnold Press", "Shoulders", 3, "8", 120),
              ex("Seated Cable Row", "Back", 3, "10", 90),
              ex("Skull Crushers", "Triceps", 3, "10", 60),
              ex("Hammer Curl", "Biceps", 3, "10", 60),
            ],
          },
          {
            dayNumber: 4, name: "Lower B", exercises: [
              ex("Deadlift", "Legs", 4, "5", 180),
              ex("Bulgarian Split Squat", "Legs", 3, "8", 90),
              ex("Hack Squat", "Legs", 3, "10", 90),
              ex("Leg Extension", "Legs", 3, "10", 60),
              ex("Unilateral Calf Raise", "Legs", 3, "12", 60),
            ],
          },
        ],
      },
      {
        name: "Strength Build",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper A", exercises: [
              ex("Barbell Bench Press", "Chest", 5, "5", 180),
              ex("Barbell Row", "Back", 5, "5", 150),
              ex("Overhead Press", "Shoulders", 4, "6", 120),
              ex("Pull-up", "Back", 4, "8", 90),
              ex("Close-Grip Bench Press", "Triceps", 3, "8", 90),
            ],
          },
          {
            dayNumber: 2, name: "Lower A", exercises: [
              ex("Back Squat", "Legs", 5, "5", 180),
              ex("Sumo Deadlift", "Legs", 4, "6", 150),
              ex("Leg Press", "Legs", 4, "8", 90),
              ex("Leg Curl", "Legs", 3, "10", 60),
            ],
          },
          {
            dayNumber: 3, name: "Upper B", exercises: [
              ex("Incline Barbell Bench Press", "Chest", 5, "5", 180),
              ex("T-Bar Row", "Back", 5, "5", 150),
              ex("Arnold Press", "Shoulders", 4, "6", 120),
              ex("Lat Pulldown", "Back", 4, "8", 90),
              ex("Dips", "Chest", 3, "8", 90),
            ],
          },
          {
            dayNumber: 4, name: "Lower B", exercises: [
              ex("Deadlift", "Legs", 5, "3", 210),
              ex("Bulgarian Split Squat", "Legs", 4, "6", 90),
              ex("Hack Squat", "Legs", 4, "8", 90),
              ex("Calf Raise", "Legs", 4, "12", 60),
            ],
          },
        ],
      },
      {
        name: "Peak Strength",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper A", exercises: [
              ex("Barbell Bench Press", "Chest", 5, "3", 210),
              ex("Barbell Row", "Back", 5, "5", 150),
              ex("Overhead Press", "Shoulders", 4, "5", 150),
            ],
          },
          {
            dayNumber: 2, name: "Lower A", exercises: [
              ex("Back Squat", "Legs", 5, "3", 210),
              ex("Romanian Deadlift", "Legs", 3, "6", 120),
              ex("Leg Press", "Legs", 3, "8", 90),
            ],
          },
          {
            dayNumber: 3, name: "Upper B", exercises: [
              ex("Incline Barbell Bench Press", "Chest", 5, "3", 210),
              ex("T-Bar Row", "Back", 5, "5", 150),
              ex("Pull-up", "Back", 4, "6", 120),
            ],
          },
          {
            dayNumber: 4, name: "Lower B", exercises: [
              ex("Deadlift", "Legs", 5, "2", 240),
              ex("Bulgarian Split Squat", "Legs", 3, "6", 90),
              ex("Hack Squat", "Legs", 3, "8", 90),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "hypertrophy",
    name: "Hypertrophy Blueprint",
    description: "A 12-week 5-day push/pull/legs/upper/lower split designed to maximize muscle growth through progressive volume.",
    focus: "Hypertrophy",
    durationWeeks: 12,
    phases: [
      {
        name: "Volume Accumulation",
        durationWeeks: 4,
        daysPerWeek: 5,
        days: [
          {
            dayNumber: 1, name: "Push", exercises: [
              ex("Barbell Bench Press", "Chest", 4, "10", 90),
              ex("Incline Dumbbell Press", "Chest", 3, "12", 90),
              ex("Cable Fly", "Chest", 3, "15", 60),
              ex("Overhead Press", "Shoulders", 3, "10", 90),
              ex("Lateral Raise", "Shoulders", 3, "15", 45),
              ex("Tricep Pushdown", "Triceps", 3, "12", 60),
            ],
          },
          {
            dayNumber: 2, name: "Pull", exercises: [
              ex("Lat Pulldown", "Back", 4, "10", 90),
              ex("Seated Cable Row", "Back", 4, "10", 90),
              ex("Face Pull", "Back", 3, "15", 60),
              ex("Barbell Curl", "Biceps", 3, "12", 60),
              ex("Hammer Curl", "Biceps", 3, "12", 60),
            ],
          },
          {
            dayNumber: 3, name: "Legs", exercises: [
              ex("Back Squat", "Legs", 4, "10", 120),
              ex("Leg Press", "Legs", 3, "12", 90),
              ex("Leg Extension", "Legs", 3, "15", 60),
              ex("Leg Curl", "Legs", 3, "15", 60),
              ex("Calf Raise", "Legs", 4, "15", 45),
            ],
          },
          {
            dayNumber: 4, name: "Upper", exercises: [
              ex("Incline Barbell Bench Press", "Chest", 3, "10", 90),
              ex("T-Bar Row", "Back", 3, "10", 90),
              ex("Arnold Press", "Shoulders", 3, "12", 90),
              ex("Cable Curl", "Biceps", 3, "12", 60),
              ex("Skull Crushers", "Triceps", 3, "12", 60),
            ],
          },
          {
            dayNumber: 5, name: "Lower", exercises: [
              ex("Romanian Deadlift", "Legs", 4, "10", 90),
              ex("Bulgarian Split Squat", "Legs", 3, "12", 90),
              ex("Hack Squat", "Legs", 3, "12", 90),
              ex("Unilateral Leg Curl", "Legs", 3, "12", 60),
            ],
          },
        ],
      },
      {
        name: "Intensification",
        durationWeeks: 4,
        daysPerWeek: 5,
        days: [
          {
            dayNumber: 1, name: "Push", exercises: [
              ex("Barbell Bench Press", "Chest", 4, "8", 120),
              ex("Incline Dumbbell Bench Press", "Chest", 3, "10", 90),
              ex("Low Cable Crossover", "Chest", 3, "12", 60),
              ex("Overhead Press", "Shoulders", 3, "8", 90),
              ex("Cable Lateral Raise", "Shoulders", 3, "12", 45),
            ],
          },
          {
            dayNumber: 2, name: "Pull", exercises: [
              ex("Pull-up", "Back", 4, "8", 120),
              ex("T-Bar Row", "Back", 4, "8", 90),
              ex("Straight-Arm Pulldown", "Back", 3, "12", 60),
              ex("Preacher Curl", "Biceps", 3, "10", 60),
            ],
          },
          {
            dayNumber: 3, name: "Legs", exercises: [
              ex("Back Squat", "Legs", 4, "8", 150),
              ex("Sumo Deadlift", "Legs", 3, "8", 120),
              ex("Walking Lunge", "Legs", 3, "12", 90),
              ex("Unilateral Leg Extension", "Legs", 3, "12", 60),
            ],
          },
          {
            dayNumber: 4, name: "Upper", exercises: [
              ex("Dips", "Chest", 3, "10", 90),
              ex("Barbell Row", "Back", 4, "8", 90),
              ex("Rear Delt Fly", "Shoulders", 3, "12", 60),
              ex("Close-Grip Bench Press", "Triceps", 3, "10", 90),
            ],
          },
          {
            dayNumber: 5, name: "Lower", exercises: [
              ex("Deadlift", "Legs", 4, "6", 150),
              ex("Hack Squat", "Legs", 3, "10", 90),
              ex("Leg Curl", "Legs", 3, "12", 60),
              ex("Calf Raise", "Legs", 4, "15", 45),
            ],
          },
        ],
      },
      {
        name: "Peak Volume",
        durationWeeks: 4,
        daysPerWeek: 5,
        days: [
          {
            dayNumber: 1, name: "Push", exercises: [
              ex("Incline Dumbbell Fly", "Chest", 3, "15", 45),
              ex("Pec Deck", "Chest", 3, "15", 45),
              ex("Cable Fly", "Chest", 3, "15", 45),
              ex("Lateral Raise", "Shoulders", 4, "15", 45),
              ex("Tricep Pushdown", "Triceps", 4, "15", 45),
            ],
          },
          {
            dayNumber: 2, name: "Pull", exercises: [
              ex("Seated Cable Row", "Back", 4, "12", 60),
              ex("Lat Pulldown", "Back", 4, "12", 60),
              ex("Face Pull", "Back", 4, "15", 45),
              ex("Cable Curl", "Biceps", 4, "15", 45),
            ],
          },
          {
            dayNumber: 3, name: "Legs", exercises: [
              ex("Leg Press", "Legs", 4, "15", 60),
              ex("Leg Extension", "Legs", 4, "15", 45),
              ex("Leg Curl", "Legs", 4, "15", 45),
              ex("Unilateral Calf Raise", "Legs", 4, "15", 45),
            ],
          },
          {
            dayNumber: 4, name: "Upper", exercises: [
              ex("Cable Fly", "Chest", 3, "15", 45),
              ex("Straight-Arm Pulldown", "Back", 3, "15", 45),
              ex("Unilateral Dumbbell Lateral Raise", "Shoulders", 3, "15", 45),
              ex("Overhead Tricep Extension", "Triceps", 3, "15", 45),
            ],
          },
          {
            dayNumber: 5, name: "Lower", exercises: [
              ex("Walking Lunge", "Legs", 3, "15", 45),
              ex("Donkey Kick", "Glutes", 3, "15", 45),
              ex("Hip Abduction", "Glutes", 3, "15", 45),
              ex("Calf Raise", "Legs", 4, "20", 45),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "functional",
    name: "Functional Foundations",
    description: "A 12-week, 3-day full-body program built on compound and functional movement patterns for everyday strength and conditioning.",
    focus: "Functional Training",
    durationWeeks: 12,
    phases: [
      {
        name: "Movement Foundations",
        durationWeeks: 4,
        daysPerWeek: 3,
        days: [
          {
            dayNumber: 1, name: "Full Body A", exercises: [
              ex("Back Squat", "Legs", 3, "10", 90),
              ex("Push-Up", "Chest", 3, "12", 60),
              ex("Barbell Row", "Back", 3, "10", 90),
              ex("Plank", "Core", 3, "30s", 45),
              ex("Glute Bridge", "Glutes", 3, "12", 45),
            ],
          },
          {
            dayNumber: 2, name: "Full Body B", exercises: [
              ex("Romanian Deadlift", "Legs", 3, "10", 90),
              ex("Overhead Press", "Shoulders", 3, "10", 90),
              ex("Lat Pulldown", "Back", 3, "10", 90),
              ex("Dead Bug", "Core", 3, "12", 45),
              ex("Farmer's Carry", "Traps", 3, "30s", 60),
            ],
          },
          {
            dayNumber: 3, name: "Full Body C", exercises: [
              ex("Walking Lunge", "Legs", 3, "10", 90),
              ex("Push-Up", "Chest", 3, "12", 60),
              ex("Seated Cable Row", "Back", 3, "10", 90),
              ex("Russian Twist", "Core", 3, "15", 45),
              ex("Hip Abduction", "Glutes", 3, "12", 45),
            ],
          },
        ],
      },
      {
        name: "Functional Strength",
        durationWeeks: 4,
        daysPerWeek: 3,
        days: [
          {
            dayNumber: 1, name: "Strength & Core", exercises: [
              ex("Back Squat", "Legs", 4, "8", 120),
              ex("Kettlebell Swings", "HIIT", 3, "15", 60),
              ex("Barbell Row", "Back", 4, "8", 90),
              ex("Ab Wheel Rollout", "Core", 3, "10", 60),
            ],
          },
          {
            dayNumber: 2, name: "Power & Pull", exercises: [
              ex("Sumo Deadlift", "Legs", 4, "8", 120),
              ex("Thruster", "HIIT", 3, "12", 60),
              ex("Pull-up", "Back", 3, "8", 90),
              ex("Side Plank", "Core", 3, "30s", 45),
            ],
          },
          {
            dayNumber: 3, name: "Unilateral & Conditioning", exercises: [
              ex("Bulgarian Split Squat", "Legs", 3, "10", 90),
              ex("Battle Ropes", "HIIT", 3, "30s", 60),
              ex("T-Bar Row", "Back", 4, "8", 90),
              ex("Hanging Leg Raise", "Core", 3, "10", 60),
            ],
          },
        ],
      },
      {
        name: "Integrated Power",
        durationWeeks: 4,
        daysPerWeek: 3,
        days: [
          {
            dayNumber: 1, name: "Power Day A", exercises: [
              ex("Box Jumps", "HIIT", 4, "5", 90),
              ex("Back Squat", "Legs", 3, "6", 150),
              ex("Battle Ropes", "HIIT", 3, "30s", 60),
              ex("Farmer's Carry", "Traps", 3, "40s", 60),
            ],
          },
          {
            dayNumber: 2, name: "Power Day B", exercises: [
              ex("Kettlebell Swings", "HIIT", 4, "15", 60),
              ex("Deadlift", "Legs", 3, "5", 150),
              ex("Mountain Climbers", "HIIT", 3, "20", 45),
              ex("Plank", "Core", 3, "45s", 45),
            ],
          },
          {
            dayNumber: 3, name: "Power Day C", exercises: [
              ex("Bear Crawl", "HIIT", 3, "30s", 60),
              ex("Bulgarian Split Squat", "Legs", 3, "8", 90),
              ex("Sled Push (HIIT)", "HIIT", 3, "20m", 90),
              ex("Russian Twist", "Core", 3, "20", 45),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "symmetry",
    name: "Symmetry & Balance",
    description: "A 10-week, 4-day program emphasizing unilateral work and single-limb stability to correct imbalances between sides.",
    focus: "Symmetry",
    durationWeeks: 10,
    phases: [
      {
        name: "Assessment & Activation",
        durationWeeks: 3,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper Unilateral", exercises: [
              ex("Single-Arm Dumbbell Row", "Back", 3, "12/side", 60),
              ex("Unilateral Dumbbell Lateral Raise", "Shoulders", 3, "12/side", 45),
              ex("Unilateral Overhead Tricep Extension", "Triceps", 3, "12/side", 45),
              ex("Unilateral Dumbbell Curl", "Biceps", 3, "12/side", 45),
            ],
          },
          {
            dayNumber: 2, name: "Lower Unilateral", exercises: [
              ex("Bulgarian Split Squat", "Legs", 3, "10/side", 90),
              ex("Single Leg Romanian Deadlift", "Mobility", 3, "10/side", 60),
              ex("Unilateral Leg Curl", "Legs", 3, "12/side", 60),
              ex("Unilateral Leg Extension", "Legs", 3, "12/side", 60),
            ],
          },
          {
            dayNumber: 3, name: "Core & Stability", exercises: [
              ex("Side Plank", "Core", 3, "30s/side", 45),
              ex("Dead Bug", "Core", 3, "12", 45),
              ex("Single Leg Balance Reach", "Mobility", 3, "10/side", 45),
              ex("Plank", "Core", 3, "45s", 45),
            ],
          },
          {
            dayNumber: 4, name: "Full Body Integration", exercises: [
              ex("Walking Lunge", "Legs", 3, "12/side", 90),
              ex("Single-Arm Dumbbell Row", "Back", 3, "12/side", 60),
              ex("Hip Abduction", "Glutes", 3, "15/side", 45),
              ex("Cable Kickback", "Glutes", 3, "15/side", 45),
            ],
          },
        ],
      },
      {
        name: "Unilateral Strength",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper Unilateral", exercises: [
              ex("Single-Arm Dumbbell Row", "Back", 4, "10/side", 60),
              ex("Unilateral Cable Lateral Raise", "Shoulders", 3, "12/side", 45),
              ex("Unilateral Hammer Curl", "Biceps", 3, "12/side", 45),
            ],
          },
          {
            dayNumber: 2, name: "Lower Unilateral", exercises: [
              ex("Bulgarian Split Squat", "Legs", 4, "10/side", 90),
              ex("Single Leg Romanian Deadlift", "Mobility", 4, "10/side", 60),
              ex("Unilateral Calf Raise", "Legs", 3, "15/side", 45),
            ],
          },
          {
            dayNumber: 3, name: "Glute & Core Balance", exercises: [
              ex("Unilateral Cable Kickback", "Glutes", 3, "15/side", 45),
              ex("Donkey Kick", "Glutes", 3, "15/side", 45),
              ex("Side Plank", "Core", 3, "45s/side", 45),
            ],
          },
          {
            dayNumber: 4, name: "Lower Body Focus", exercises: [
              ex("Walking Lunge", "Legs", 4, "12/side", 90),
              ex("Unilateral Leg Curl", "Legs", 4, "12/side", 60),
              ex("Unilateral Leg Extension", "Legs", 4, "12/side", 60),
            ],
          },
        ],
      },
      {
        name: "Integration",
        durationWeeks: 3,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Upper Integration", exercises: [
              ex("Barbell Bench Press", "Chest", 3, "8", 90),
              ex("Single-Arm Dumbbell Row", "Back", 3, "10/side", 60),
              ex("Unilateral Dumbbell Lateral Raise", "Shoulders", 3, "12/side", 45),
            ],
          },
          {
            dayNumber: 2, name: "Lower Integration", exercises: [
              ex("Back Squat", "Legs", 3, "8", 120),
              ex("Bulgarian Split Squat", "Legs", 3, "10/side", 90),
              ex("Single Leg Romanian Deadlift", "Mobility", 3, "10/side", 60),
            ],
          },
          {
            dayNumber: 3, name: "Stability Check", exercises: [
              ex("Lateral Band Walk", "Mobility", 3, "15/side", 45),
              ex("Hip Abduction", "Glutes", 3, "15/side", 45),
              ex("Single Leg Balance Reach", "Mobility", 3, "10/side", 45),
            ],
          },
          {
            dayNumber: 4, name: "Carry & Balance", exercises: [
              ex("Farmer's Carry", "Traps", 3, "40s", 60, "Alternate carrying weight in one hand for a unilateral load"),
              ex("Unilateral Leg Extension", "Legs", 3, "12/side", 60),
              ex("Unilateral Leg Curl", "Legs", 3, "12/side", 60),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "athletic-performance",
    name: "Athletic Performance",
    description: "A 12-week, 4-day program combining strength, power, and speed/agility work to build well-rounded athleticism.",
    focus: "Athletic Performance",
    durationWeeks: 12,
    phases: [
      {
        name: "General Prep",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Strength A", exercises: [
              ex("Back Squat", "Legs", 4, "8", 120),
              ex("Barbell Bench Press", "Chest", 4, "8", 120),
              ex("Barbell Row", "Back", 4, "8", 90),
            ],
          },
          {
            dayNumber: 2, name: "Conditioning", exercises: [
              ex("Assault Bike", "Cardio", 5, "1min", 60),
              ex("Jump Rope", "Cardio", 5, "1min", 45),
              ex("Mountain Climbers", "HIIT", 3, "20", 45),
            ],
          },
          {
            dayNumber: 3, name: "Strength B", exercises: [
              ex("Deadlift", "Legs", 4, "6", 150),
              ex("Overhead Press", "Shoulders", 4, "8", 90),
              ex("Pull-up", "Back", 3, "8", 90),
            ],
          },
          {
            dayNumber: 4, name: "Speed & Agility", exercises: [
              ex("Shuttle Run", "HIIT", 6, "20m", 60),
              ex("Lateral Bounds", "HIIT", 3, "10", 60),
              ex("Box Jumps", "HIIT", 3, "8", 90),
            ],
          },
        ],
      },
      {
        name: "Strength & Power",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Strength A", exercises: [
              ex("Back Squat", "Legs", 5, "5", 150),
              ex("Thruster", "HIIT", 3, "10", 60),
              ex("Barbell Row", "Back", 4, "6", 90),
            ],
          },
          {
            dayNumber: 2, name: "Power Conditioning", exercises: [
              ex("Kettlebell Swings", "HIIT", 4, "15", 60),
              ex("Sled Push (HIIT)", "HIIT", 4, "20m", 90),
              ex("Battle Ropes", "HIIT", 3, "30s", 60),
            ],
          },
          {
            dayNumber: 3, name: "Strength B", exercises: [
              ex("Deadlift", "Legs", 5, "5", 150),
              ex("Barbell Bench Press", "Chest", 4, "6", 120),
              ex("Pull-up", "Back", 4, "8", 90),
            ],
          },
          {
            dayNumber: 4, name: "Explosive Power", exercises: [
              ex("Box Jumps", "HIIT", 4, "6", 90),
              ex("Tuck Jumps", "HIIT", 3, "8", 60),
              ex("Sprint Intervals", "HIIT", 6, "100m", 90),
            ],
          },
        ],
      },
      {
        name: "Speed & Peak Power",
        durationWeeks: 4,
        daysPerWeek: 4,
        days: [
          {
            dayNumber: 1, name: "Peak Strength", exercises: [
              ex("Back Squat", "Legs", 4, "4", 180),
              ex("Jump Squats", "HIIT", 3, "8", 90),
              ex("Barbell Row", "Back", 3, "6", 90),
            ],
          },
          {
            dayNumber: 2, name: "Speed Work", exercises: [
              ex("Sprint Intervals", "HIIT", 8, "100m", 90),
              ex("Shuttle Run", "HIIT", 6, "20m", 60),
              ex("Lateral Bounds", "HIIT", 4, "10", 60),
            ],
          },
          {
            dayNumber: 3, name: "Peak Strength B", exercises: [
              ex("Deadlift", "Legs", 4, "3", 210),
              ex("Box Jumps", "HIIT", 4, "5", 90),
              ex("Bulgarian Split Squat", "Legs", 3, "8", 90),
            ],
          },
          {
            dayNumber: 4, name: "Explosive Conditioning", exercises: [
              ex("Plyo Push-Ups", "HIIT", 3, "8", 60),
              ex("Tuck Jumps", "HIIT", 4, "8", 60),
              ex("Burpees", "HIIT", 3, "15", 45),
            ],
          },
        ],
      },
    ],
  },
];

export function getProgramTemplate(key: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find(t => t.key === key);
}
