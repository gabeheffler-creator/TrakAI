import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  db,
  coachesTable,
  clientsTable,
  measurementsTable,
  sleepLogsTable,
  workoutLogsTable,
  setLogsTable,
  progressPhotosTable,
  clientTasksTable,
  exercisesTable,
  programAssignmentsTable,
  programAssignmentHistoryTable,
  programsTable,
  nutritionGoalsTable,
  nutritionLogsTable,
  messagesTable,
  assignmentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { instantiateAllProgramTemplatesForCoach } from "../services/program_templates";

const SALT_ROUNDS = 10;
const BUCKET = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const PRIVATE_PREFIX = ".private/uploads";

const COACH = {
  username: "coach",
  password: "coach",
  name: "Alex Coach",
  email: "coach@trak.demo",
};

const CLIENTS = [
  { username: "alex",   password: "alex",   name: "Alex Johnson",  email: "alex@trak.demo",   goal: "Build muscle and strength" },
  { username: "sam",    password: "sam",    name: "Sam Williams",  email: "sam@trak.demo",    goal: "Lose weight and improve cardio" },
  { username: "jordan", password: "jordan", name: "Jordan Rivera", email: "jordan@trak.demo", goal: "Athletic performance" },
];

// ── Measurements (with body fat trend) ───────────────────────────────────────
const MEASUREMENTS = (id: number) => [
  { clientId: id, date: "2026-02-03", weight: "191.5", bodyFat: "23.5", chest: "44.5", waist: "36.5", hips: "40.0", leftArm: "15.2", rightArm: "15.4", leftThigh: "24.5", rightThigh: "24.5", leftCalf: "15.0", rightCalf: "15.0", unit: "imperial" },
  { clientId: id, date: "2026-02-17", weight: "189.8", bodyFat: "23.1", chest: "44.2", waist: "36.0", hips: "39.8", leftArm: "15.3", rightArm: "15.4", leftThigh: "24.4", rightThigh: "24.5", leftCalf: "15.0", rightCalf: "15.1", unit: "imperial" },
  { clientId: id, date: "2026-03-03", weight: "188.4", bodyFat: "22.7", chest: "43.8", waist: "35.5", hips: "39.5", leftArm: "15.4", rightArm: "15.5", leftThigh: "24.3", rightThigh: "24.4", leftCalf: "15.1", rightCalf: "15.1", unit: "imperial" },
  { clientId: id, date: "2026-03-17", weight: "187.1", bodyFat: "22.3", chest: "43.5", waist: "35.2", hips: "39.2", leftArm: "15.5", rightArm: "15.6", leftThigh: "24.2", rightThigh: "24.3", leftCalf: "15.1", rightCalf: "15.2", unit: "imperial" },
  { clientId: id, date: "2026-04-07", weight: "185.9", bodyFat: "21.9", chest: "43.2", waist: "34.8", hips: "39.0", leftArm: "15.6", rightArm: "15.7", leftThigh: "24.0", rightThigh: "24.1", leftCalf: "15.2", rightCalf: "15.2", unit: "imperial" },
  { clientId: id, date: "2026-04-21", weight: "184.5", bodyFat: "21.5", chest: "42.8", waist: "34.5", hips: "38.7", leftArm: "15.7", rightArm: "15.8", leftThigh: "23.9", rightThigh: "24.0", leftCalf: "15.2", rightCalf: "15.3", unit: "imperial" },
  { clientId: id, date: "2026-05-05", weight: "183.2", bodyFat: "21.2", chest: "42.5", waist: "34.0", hips: "38.5", leftArm: "15.8", rightArm: "15.9", leftThigh: "23.8", rightThigh: "23.9", leftCalf: "15.3", rightCalf: "15.3", unit: "imperial" },
  { clientId: id, date: "2026-05-19", weight: "182.1", bodyFat: "21.0", chest: "42.2", waist: "33.8", hips: "38.2", leftArm: "15.9", rightArm: "16.0", leftThigh: "23.7", rightThigh: "23.8", leftCalf: "15.3", rightCalf: "15.4", unit: "imperial" },
  { clientId: id, date: "2026-06-02", weight: "180.8", bodyFat: "20.8", chest: "42.0", waist: "33.5", hips: "38.0", leftArm: "16.0", rightArm: "16.1", leftThigh: "23.6", rightThigh: "23.7", leftCalf: "15.4", rightCalf: "15.4", unit: "imperial" },
];

// ── Sleep logs — extended Feb–Jun for a full trend ────────────────────────────
const SLEEP_LOGS = (id: number) => [
  // February
  { clientId: id, date: "2026-02-03", hoursSlept: "7.0", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-02-10", hoursSlept: "6.5", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-02-17", hoursSlept: "8.0", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-02-24", hoursSlept: "5.5", quality: "fair",  energyRating: 5 },
  // March
  { clientId: id, date: "2026-03-03", hoursSlept: "7.5", quality: "great", energyRating: 8 },
  { clientId: id, date: "2026-03-10", hoursSlept: "6.0", quality: "fair",  energyRating: 6 },
  { clientId: id, date: "2026-03-17", hoursSlept: "7.5", quality: "good",  energyRating: 8 },
  { clientId: id, date: "2026-03-24", hoursSlept: "8.5", quality: "great", energyRating: 9 },
  // April
  { clientId: id, date: "2026-04-07", hoursSlept: "7.0", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-04-14", hoursSlept: "6.5", quality: "fair",  energyRating: 5 },
  { clientId: id, date: "2026-04-21", hoursSlept: "8.0", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-04-28", hoursSlept: "7.5", quality: "good",  energyRating: 8 },
  // May
  { clientId: id, date: "2026-05-05", hoursSlept: "7.0", quality: "good",  energyRating: 8 },
  { clientId: id, date: "2026-05-12", hoursSlept: "8.5", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-05-19", hoursSlept: "6.5", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-05-25", hoursSlept: "7.5", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-05-26", hoursSlept: "6.5", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-05-27", hoursSlept: "8.0", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-05-28", hoursSlept: "7.0", quality: "good",  energyRating: 7 },
  { clientId: id, date: "2026-05-29", hoursSlept: "5.5", quality: "fair",  energyRating: 5 },
  { clientId: id, date: "2026-05-30", hoursSlept: "9.0", quality: "great", energyRating: 10 },
  { clientId: id, date: "2026-05-31", hoursSlept: "7.5", quality: "good",  energyRating: 8 },
  // June
  { clientId: id, date: "2026-06-01", hoursSlept: "6.0", quality: "fair",  energyRating: 6 },
  { clientId: id, date: "2026-06-02", hoursSlept: "8.5", quality: "great", energyRating: 9 },
  { clientId: id, date: "2026-06-03", hoursSlept: "7.0", quality: "good",  energyRating: 8 },
  { clientId: id, date: "2026-06-04", hoursSlept: "4.5", quality: "poor",  energyRating: 3 },
  { clientId: id, date: "2026-06-05", hoursSlept: "9.5", quality: "great", energyRating: 10 },
  { clientId: id, date: "2026-06-06", hoursSlept: "7.5", quality: "good",  energyRating: 8 },
];

// ── Workout sessions ──────────────────────────────────────────────────────────
const WORKOUT_SESSIONS = [
  {
    date: "2026-02-03", name: "Push Day", duration: 65,
    sets: [
      ["Barbell Bench Press",1,8,175],["Barbell Bench Press",2,8,175],["Barbell Bench Press",3,7,185],["Barbell Bench Press",4,6,185],
      ["Incline Dumbbell Press",1,10,65],["Incline Dumbbell Press",2,10,65],["Incline Dumbbell Press",3,9,70],
      ["Overhead Press",1,10,115],["Overhead Press",2,10,115],["Overhead Press",3,8,120],
      ["Skull Crushers",1,12,75],["Skull Crushers",2,12,75],["Skull Crushers",3,10,85],
      ["Cable Fly",1,15,40],["Cable Fly",2,15,40],["Cable Fly",3,12,45],
    ],
  },
  {
    date: "2026-02-05", name: "Pull Day", duration: 68,
    sets: [
      ["Pull-up",1,8,null],["Pull-up",2,8,null],["Pull-up",3,7,null],
      ["T-Bar Row",1,8,115],["T-Bar Row",2,8,115],["T-Bar Row",3,8,125],
      ["Lat Pulldown",1,12,150],["Lat Pulldown",2,12,150],["Lat Pulldown",3,10,160],
      ["Hammer Curl",1,12,40],["Hammer Curl",2,12,40],["Hammer Curl",3,10,45],
      ["Straight-Arm Pulldown",1,15,50],["Straight-Arm Pulldown",2,15,50],["Straight-Arm Pulldown",3,12,55],
    ],
  },
  {
    date: "2026-02-07", name: "Legs Day", duration: 78,
    sets: [
      ["Back Squat",1,8,215],["Back Squat",2,8,215],["Back Squat",3,6,235],["Back Squat",4,5,235],
      ["Deadlift",1,6,265],["Deadlift",2,6,265],["Deadlift",3,5,285],["Deadlift",4,3,305],
      ["Leg Press",1,12,360],["Leg Press",2,12,360],["Leg Press",3,10,400],
      ["Bulgarian Split Squat",1,10,50],["Bulgarian Split Squat",2,10,50],["Bulgarian Split Squat",3,8,60],
      ["Calf Raise",1,15,180],["Calf Raise",2,15,180],["Calf Raise",3,15,200],
    ],
  },
  {
    date: "2026-03-03", name: "Push Day", duration: 67,
    sets: [
      ["Barbell Bench Press",1,8,185],["Barbell Bench Press",2,8,185],["Barbell Bench Press",3,7,195],["Barbell Bench Press",4,6,195],
      ["Incline Dumbbell Press",1,10,70],["Incline Dumbbell Press",2,10,70],["Incline Dumbbell Press",3,8,75],
      ["Overhead Press",1,10,120],["Overhead Press",2,9,120],["Overhead Press",3,8,125],
      ["Skull Crushers",1,12,80],["Skull Crushers",2,12,80],["Skull Crushers",3,10,90],
      ["Cable Fly",1,15,42],["Cable Fly",2,15,42],["Cable Fly",3,12,47],
    ],
  },
  {
    date: "2026-03-17", name: "Pull Day", duration: 71,
    sets: [
      ["Pull-up",1,9,null],["Pull-up",2,8,null],["Pull-up",3,8,null],
      ["T-Bar Row",1,8,125],["T-Bar Row",2,8,125],["T-Bar Row",3,8,135],
      ["Lat Pulldown",1,12,157],["Lat Pulldown",2,12,157],["Lat Pulldown",3,10,167],
      ["Hammer Curl",1,12,42],["Hammer Curl",2,12,42],["Hammer Curl",3,10,47],
      ["Straight-Arm Pulldown",1,15,52],["Straight-Arm Pulldown",2,15,52],["Straight-Arm Pulldown",3,12,57],
    ],
  },
  {
    date: "2026-04-07", name: "Legs Day", duration: 80,
    sets: [
      ["Back Squat",1,8,230],["Back Squat",2,8,230],["Back Squat",3,6,250],["Back Squat",4,5,250],
      ["Deadlift",1,6,280],["Deadlift",2,6,280],["Deadlift",3,5,300],["Deadlift",4,3,320],
      ["Leg Press",1,12,380],["Leg Press",2,12,380],["Leg Press",3,10,420],
      ["Bulgarian Split Squat",1,10,55],["Bulgarian Split Squat",2,10,55],["Bulgarian Split Squat",3,8,65],
      ["Calf Raise",1,15,190],["Calf Raise",2,15,190],["Calf Raise",3,15,210],
    ],
  },
  {
    date: "2026-04-21", name: "Push Day", duration: 63,
    sets: [
      ["Barbell Bench Press",1,8,190],["Barbell Bench Press",2,8,190],["Barbell Bench Press",3,7,200],["Barbell Bench Press",4,6,200],
      ["Incline Dumbbell Press",1,10,72],["Incline Dumbbell Press",2,10,72],["Incline Dumbbell Press",3,8,77],
      ["Overhead Press",1,10,122],["Overhead Press",2,9,122],["Overhead Press",3,8,127],
      ["Skull Crushers",1,12,82],["Skull Crushers",2,12,82],["Skull Crushers",3,10,92],
      ["Cable Fly",1,15,43],["Cable Fly",2,15,43],["Cable Fly",3,12,48],
    ],
  },
  {
    date: "2026-05-05", name: "Pull Day", duration: 69,
    sets: [
      ["Pull-up",1,10,null],["Pull-up",2,9,null],["Pull-up",3,8,null],
      ["T-Bar Row",1,8,130],["T-Bar Row",2,8,130],["T-Bar Row",3,8,140],
      ["Lat Pulldown",1,12,162],["Lat Pulldown",2,12,162],["Lat Pulldown",3,10,172],
      ["Hammer Curl",1,12,44],["Hammer Curl",2,12,44],["Hammer Curl",3,10,48],
      ["Straight-Arm Pulldown",1,15,53],["Straight-Arm Pulldown",2,15,53],["Straight-Arm Pulldown",3,12,58],
    ],
  },
  {
    date: "2026-05-19", name: "Push Day", duration: 66,
    sets: [
      ["Barbell Bench Press",1,8,193],["Barbell Bench Press",2,8,193],["Barbell Bench Press",3,7,202],["Barbell Bench Press",4,5,202],
      ["Incline Dumbbell Press",1,10,73],["Incline Dumbbell Press",2,10,73],["Incline Dumbbell Press",3,8,78],
      ["Overhead Press",1,10,123],["Overhead Press",2,9,123],["Overhead Press",3,8,128],
      ["Skull Crushers",1,12,84],["Skull Crushers",2,12,84],["Skull Crushers",3,10,93],
      ["Cable Fly",1,15,44],["Cable Fly",2,15,44],["Cable Fly",3,12,49],
    ],
  },
  {
    date: "2026-06-02", name: "Push Day", duration: 70,
    sets: [
      ["Barbell Bench Press",1,8,195],["Barbell Bench Press",2,8,195],["Barbell Bench Press",3,6,205],["Barbell Bench Press",4,5,205],
      ["Incline Dumbbell Press",1,10,75],["Incline Dumbbell Press",2,10,75],["Incline Dumbbell Press",3,8,80],
      ["Overhead Press",1,10,125],["Overhead Press",2,9,125],["Overhead Press",3,8,130],
      ["Skull Crushers",1,12,85],["Skull Crushers",2,12,85],["Skull Crushers",3,10,95],
      ["Cable Fly",1,15,45],["Cable Fly",2,15,45],["Cable Fly",3,12,50],
    ],
  },
  {
    date: "2026-06-04", name: "Pull Day", duration: 74,
    sets: [
      ["Pull-up",1,10,null],["Pull-up",2,9,null],["Pull-up",3,8,null],
      ["T-Bar Row",1,8,135],["T-Bar Row",2,8,135],["T-Bar Row",3,8,145],
      ["Lat Pulldown",1,12,165],["Lat Pulldown",2,12,165],["Lat Pulldown",3,10,175],
      ["Hammer Curl",1,12,45],["Hammer Curl",2,12,45],["Hammer Curl",3,10,50],
      ["Straight-Arm Pulldown",1,15,55],["Straight-Arm Pulldown",2,15,55],["Straight-Arm Pulldown",3,12,60],
    ],
  },
  {
    date: "2026-06-06", name: "Legs Day", duration: 82,
    sets: [
      ["Back Squat",1,8,245],["Back Squat",2,8,245],["Back Squat",3,6,265],["Back Squat",4,5,265],
      ["Deadlift",1,6,295],["Deadlift",2,6,295],["Deadlift",3,5,315],["Deadlift",4,3,335],
      ["Leg Press",1,12,400],["Leg Press",2,12,400],["Leg Press",3,10,440],
      ["Bulgarian Split Squat",1,10,60],["Bulgarian Split Squat",2,10,60],["Bulgarian Split Squat",3,8,70],
      ["Calf Raise",1,15,200],["Calf Raise",2,15,200],["Calf Raise",3,15,220],
    ],
  },
];

// ── Progress photos ───────────────────────────────────────────────────────────
const PHOTO_FILES = [
  { file: "progress-front-week1.png", date: "2026-02-03", notes: "Week 1 — front" },
  { file: "progress-front-week6.png", date: "2026-03-17", notes: "Week 6 — front" },
  { file: "progress-back-week6.png",  date: "2026-03-17", notes: "Week 6 — back"  },
];

// ── Nutrition goals ───────────────────────────────────────────────────────────
const NUTRITION_GOALS = (id: number) => [
  { clientId: id, dayType: "training", calories: 2800, protein: 210, carbs: 300, fat: 70, waterOz: 100 },
  { clientId: id, dayType: "rest",     calories: 2400, protein: 200, carbs: 220, fat: 75, waterOz: 100 },
];

// ── Nutrition logs — ~30 entries across Feb–Jun ───────────────────────────────
// Workout dates get training-day macros; other dates get rest-day macros.
const WORKOUT_DATES = new Set([
  "2026-02-03","2026-02-05","2026-02-07",
  "2026-03-03","2026-03-17",
  "2026-04-07","2026-04-21",
  "2026-05-05","2026-05-19",
  "2026-06-02","2026-06-04","2026-06-06",
]);

const NUTRITION_LOG_DATES = [
  "2026-02-03","2026-02-05","2026-02-07","2026-02-10","2026-02-17",
  "2026-03-03","2026-03-10","2026-03-17","2026-03-24",
  "2026-04-07","2026-04-14","2026-04-21","2026-04-28",
  "2026-05-05","2026-05-12","2026-05-19","2026-05-25","2026-05-26",
  "2026-05-27","2026-05-28","2026-05-29","2026-05-30","2026-05-31",
  "2026-06-01","2026-06-02","2026-06-03","2026-06-04","2026-06-05","2026-06-06",
];

const NUTRITION_LOGS = (id: number) => {
  // Dates with MFP screenshots — skip cant_track for those days
  const alexMfpDates = new Set(["2026-02-03","2026-03-03","2026-04-07","2026-05-19","2026-06-04"]);
  return [
    // Water-only entries (sprinkled through the range)
    { clientId: id, date: "2026-02-10", imageUrl: "water_only", waterMl: 2366 }, // ~80 oz
    { clientId: id, date: "2026-03-10", imageUrl: "water_only", waterMl: 2722 },
    { clientId: id, date: "2026-04-14", imageUrl: "water_only", waterMl: 2485 },
    { clientId: id, date: "2026-05-12", imageUrl: "water_only", waterMl: 2840 },
    // Macro entries — training days (higher carbs); skip MFP screenshot dates
    ...NUTRITION_LOG_DATES.filter(d => WORKOUT_DATES.has(d) && !alexMfpDates.has(d)).map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 2780 + Math.round(Math.random() * 80 - 40),
      protein: 208 + Math.round(Math.random() * 10 - 5),
      carbs:   295 + Math.round(Math.random() * 20 - 10),
      fat:      68 + Math.round(Math.random() * 8 - 4),
      waterMl: 2840, // ~96 oz
    })),
    // Macro entries — rest days
    ...NUTRITION_LOG_DATES.filter(d => !WORKOUT_DATES.has(d) && d !== "2026-02-10" && d !== "2026-03-10" && d !== "2026-04-14" && d !== "2026-05-12").map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 2380 + Math.round(Math.random() * 80 - 40),
      protein: 198 + Math.round(Math.random() * 10 - 5),
      carbs:   215 + Math.round(Math.random() * 20 - 10),
      fat:      74 + Math.round(Math.random() * 8 - 4),
      waterMl: 2485, // ~84 oz
    })),
  ];
};

// ── Messages ──────────────────────────────────────────────────────────────────
const MESSAGES = (id: number) => [
  { clientId: id, sender: "coach",  content: "Hey Alex! How's the new program feeling so far? First week is always the hardest.", createdAt: new Date("2026-02-04T10:00:00Z") },
  { clientId: id, sender: "client", content: "Legs day nearly killed me 😅 but I'm loving it. Squats felt strong.", createdAt: new Date("2026-02-04T10:45:00Z") },
  { clientId: id, sender: "coach",  content: "That's what we like to hear. Make sure you're hitting your protein every day — it'll make a big difference for recovery.", createdAt: new Date("2026-02-04T11:00:00Z") },
  { clientId: id, sender: "client", content: "Will do. My nutrition has been on point this week. Logged every meal.", createdAt: new Date("2026-02-05T08:30:00Z") },
  { clientId: id, sender: "coach",  content: "Perfect. I looked at your measurements from the 3rd — great starting point. Let's check in again mid-March.", createdAt: new Date("2026-02-17T09:00:00Z") },
  { clientId: id, sender: "client", content: "Sounds good. I took progress photos today too!", createdAt: new Date("2026-03-17T18:00:00Z") },
  { clientId: id, sender: "coach",  content: "Nice work — already seeing real changes in 6 weeks. Keep the momentum going into April.", createdAt: new Date("2026-03-18T10:00:00Z") },
  { clientId: id, sender: "client", content: "Down almost 5 lbs and waist is tighter. Feeling way stronger on squats.", createdAt: new Date("2026-03-18T10:30:00Z") },
  { clientId: id, sender: "coach",  content: "Deadlift session on the 7th was solid. How did your lower back feel after?", createdAt: new Date("2026-04-08T09:00:00Z") },
  { clientId: id, sender: "client", content: "A little tight the next morning but fine by afternoon. I stretched properly after.", createdAt: new Date("2026-04-08T09:20:00Z") },
  { clientId: id, sender: "coach",  content: "Good. If that happens again, drop the last set on deadlifts and add 5 min of hip flexor work. Your sleep last night looked rough — anything going on?", createdAt: new Date("2026-06-05T08:00:00Z") },
  { clientId: id, sender: "client", content: "Yeah, work stress. Should be better now though. Hit 9.5h last night to make up for it lol.", createdAt: new Date("2026-06-05T12:00:00Z") },
  { clientId: id, sender: "coach",  content: "Ha, well-rested is good. Leg day today — let's see a new squat PR 💪", createdAt: new Date("2026-06-06T07:30:00Z") },
  { clientId: id, sender: "client", content: "265 for 3 on back squat! New all-time PR 🔥", createdAt: new Date("2026-06-06T20:00:00Z") },
  { clientId: id, sender: "coach",  content: "Let's go!! That's what consistent training looks like. Log your nutrition tonight and we'll plan next week.", createdAt: new Date("2026-06-06T20:15:00Z") },
];

// ── Assignments ───────────────────────────────────────────────────────────────
const ASSIGNMENTS = (id: number) => [
  { clientId: id, title: "Track sleep every night for a week", type: "habit", body: "Log your sleep quality and hours each morning using the Sleep tab.", status: "completed", dueDate: "2026-06-01", completedAt: new Date("2026-06-01T22:00:00Z") },
  { clientId: id, title: "Hit protein goal 5 out of 7 days",  type: "habit", body: "Aim for 200g+ protein on at least 5 days this week.", status: "completed", dueDate: "2026-05-31", completedAt: new Date("2026-05-31T21:00:00Z") },
  { clientId: id, title: "Submit check-in photos by Sunday",  type: "task",  body: "Take front and back progress photos in the same lighting and pose as last time.", status: "completed", dueDate: "2026-03-17", completedAt: new Date("2026-03-17T09:15:00Z") },
  { clientId: id, title: "Drink 100 oz of water daily",       type: "habit", body: "Use the Nutrition tab to log your water intake each day.", status: "pending", dueDate: "2026-07-06" },
  { clientId: id, title: "Complete all 3 PPL sessions this week", type: "task", body: "Push, Pull, and Legs — all three before the week ends.", status: "pending", dueDate: "2026-07-12" },
];

// ── Completed + pending client tasks ──────────────────────────────────────────
const CLIENT_TASKS = (id: number) => [
  // Completed
  { clientId: id, text: "Log meals for 3 consecutive days", status: "completed", dueDate: "2026-02-10", completedAt: new Date("2026-02-09T18:30:00Z") },
  { clientId: id, text: "Complete 3 workouts this week",    status: "completed", dueDate: "2026-02-14", completedAt: new Date("2026-02-13T20:00:00Z") },
  { clientId: id, text: "Take progress photos",             status: "completed", dueDate: "2026-03-17", completedAt: new Date("2026-03-17T09:15:00Z") },
  { clientId: id, text: "Hit 180 lbs bodyweight",           status: "completed", dueDate: "2026-06-15", completedAt: new Date("2026-06-06T08:00:00Z") },
  { clientId: id, text: "Log sleep every day for a week",   status: "completed", dueDate: "2026-06-01", completedAt: new Date("2026-06-01T22:00:00Z") },
  { clientId: id, text: "Complete a full PPL week",         status: "completed", dueDate: "2026-06-08", completedAt: new Date("2026-06-07T19:45:00Z") },
  // Active — accepted by client, showing on Tasks page
  { clientId: id, text: "Log today's nutrition",              status: "accepted", dueDate: "2026-07-27" },
  { clientId: id, text: "Complete this week's leg day",       status: "accepted", dueDate: "2026-07-31" },
  // Pending — assigned but not yet accepted
  { clientId: id, text: "Send coach a check-in message",      status: "pending", dueDate: "2026-07-28" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SAM — fat loss / cardio focus (165 → 157 lbs, 28.5 → 25.2% BF)
// ─────────────────────────────────────────────────────────────────────────────

const SAM_MEASUREMENTS = (id: number) => [
  { clientId: id, date: "2026-02-03", weight: "165.2", bodyFat: "28.5", chest: "38.5", waist: "34.0", hips: "41.5", leftArm: "13.5", rightArm: "13.6", leftThigh: "24.0", rightThigh: "24.0", leftCalf: "14.0", rightCalf: "14.0", unit: "imperial" },
  { clientId: id, date: "2026-02-17", weight: "164.1", bodyFat: "28.1", chest: "38.3", waist: "33.6", hips: "41.2", leftArm: "13.5", rightArm: "13.6", leftThigh: "23.8", rightThigh: "23.8", leftCalf: "13.9", rightCalf: "14.0", unit: "imperial" },
  { clientId: id, date: "2026-03-03", weight: "163.0", bodyFat: "27.6", chest: "38.0", waist: "33.2", hips: "40.9", leftArm: "13.6", rightArm: "13.7", leftThigh: "23.6", rightThigh: "23.6", leftCalf: "13.9", rightCalf: "13.9", unit: "imperial" },
  { clientId: id, date: "2026-03-17", weight: "162.0", bodyFat: "27.2", chest: "37.8", waist: "32.8", hips: "40.6", leftArm: "13.6", rightArm: "13.7", leftThigh: "23.4", rightThigh: "23.4", leftCalf: "13.8", rightCalf: "13.9", unit: "imperial" },
  { clientId: id, date: "2026-04-07", weight: "160.8", bodyFat: "26.7", chest: "37.5", waist: "32.4", hips: "40.2", leftArm: "13.7", rightArm: "13.8", leftThigh: "23.2", rightThigh: "23.2", leftCalf: "13.8", rightCalf: "13.8", unit: "imperial" },
  { clientId: id, date: "2026-04-21", weight: "159.5", bodyFat: "26.1", chest: "37.2", waist: "32.0", hips: "39.8", leftArm: "13.7", rightArm: "13.8", leftThigh: "23.0", rightThigh: "23.0", leftCalf: "13.7", rightCalf: "13.8", unit: "imperial" },
  { clientId: id, date: "2026-05-05", weight: "158.5", bodyFat: "25.7", chest: "37.0", waist: "31.7", hips: "39.5", leftArm: "13.8", rightArm: "13.9", leftThigh: "22.8", rightThigh: "22.9", leftCalf: "13.7", rightCalf: "13.7", unit: "imperial" },
  { clientId: id, date: "2026-05-19", weight: "157.8", bodyFat: "25.4", chest: "36.8", waist: "31.5", hips: "39.3", leftArm: "13.8", rightArm: "13.9", leftThigh: "22.7", rightThigh: "22.7", leftCalf: "13.6", rightCalf: "13.7", unit: "imperial" },
  { clientId: id, date: "2026-06-02", weight: "157.4", bodyFat: "25.2", chest: "36.6", waist: "31.2", hips: "39.0", leftArm: "13.9", rightArm: "14.0", leftThigh: "22.5", rightThigh: "22.5", leftCalf: "13.6", rightCalf: "13.6", unit: "imperial" },
];

const SAM_SLEEP_LOGS = (id: number) => [
  // Feb
  { clientId: id, date: "2026-02-03", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-02-05", hoursSlept: "6.5", quality: "fair",      energyRating: 5 },
  { clientId: id, date: "2026-02-08", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-12", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-17", hoursSlept: "6.0", quality: "poor",      energyRating: 3 },
  { clientId: id, date: "2026-02-22", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-02-26", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  // Mar
  { clientId: id, date: "2026-03-03", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-03-08", hoursSlept: "6.5", quality: "fair",      energyRating: 6 },
  { clientId: id, date: "2026-03-13", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-03-17", hoursSlept: "8.0", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-03-22", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-03-27", hoursSlept: "6.5", quality: "fair",      energyRating: 5 },
  // Apr
  { clientId: id, date: "2026-04-02", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-04-07", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-04-14", hoursSlept: "6.0", quality: "poor",      energyRating: 4 },
  { clientId: id, date: "2026-04-21", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-04-28", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  // May
  { clientId: id, date: "2026-05-05", hoursSlept: "8.0", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-05-12", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-05-19", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-05-26", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  // Jun
  { clientId: id, date: "2026-06-02", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-06-05", hoursSlept: "6.5", quality: "fair",      energyRating: 6 },
  { clientId: id, date: "2026-06-07", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
];

const SAM_WORKOUT_DATES = new Set([
  "2026-02-03","2026-02-06","2026-02-10",
  "2026-03-03","2026-03-17",
  "2026-04-07","2026-04-21",
  "2026-05-05","2026-05-19","2026-05-28",
]);

const SAM_WORKOUT_SESSIONS = [
  {
    date: "2026-02-03", name: "Push Day", duration: 52,
    sets: [
      ["Bench Press",1,12,95],["Bench Press",2,12,95],["Bench Press",3,10,100],
      ["Overhead Press",1,12,55],["Overhead Press",2,12,55],["Overhead Press",3,10,60],
      ["Cable Fly",1,15,30],["Cable Fly",2,15,30],["Cable Fly",3,12,35],
    ],
  },
  {
    date: "2026-02-06", name: "Pull Day", duration: 48,
    sets: [
      ["Lat Pulldown",1,12,90],["Lat Pulldown",2,12,90],["Lat Pulldown",3,10,100],
      ["T-Bar Row",1,12,65],["T-Bar Row",2,12,65],["T-Bar Row",3,10,75],
      ["Hammer Curl",1,15,25],["Hammer Curl",2,15,25],["Hammer Curl",3,12,30],
    ],
  },
  {
    date: "2026-02-10", name: "Legs Day", duration: 55,
    sets: [
      ["Leg Press",1,15,180],["Leg Press",2,15,180],["Leg Press",3,12,200],
      ["Bulgarian Split Squat",1,12,20],["Bulgarian Split Squat",2,12,20],["Bulgarian Split Squat",3,10,25],
      ["Calf Raise",1,20,100],["Calf Raise",2,20,100],["Calf Raise",3,18,110],
    ],
  },
  {
    date: "2026-03-03", name: "Push Day", duration: 54,
    sets: [
      ["Bench Press",1,12,100],["Bench Press",2,12,100],["Bench Press",3,10,105],
      ["Overhead Press",1,12,60],["Overhead Press",2,12,60],["Overhead Press",3,10,65],
      ["Cable Fly",1,15,32],["Cable Fly",2,15,32],["Cable Fly",3,12,35],
    ],
  },
  {
    date: "2026-03-17", name: "Legs Day", duration: 57,
    sets: [
      ["Leg Press",1,15,200],["Leg Press",2,15,200],["Leg Press",3,12,220],
      ["Bulgarian Split Squat",1,12,25],["Bulgarian Split Squat",2,12,25],["Bulgarian Split Squat",3,10,30],
      ["Calf Raise",1,20,110],["Calf Raise",2,20,110],["Calf Raise",3,18,120],
    ],
  },
  {
    date: "2026-04-07", name: "Push Day", duration: 53,
    sets: [
      ["Bench Press",1,12,105],["Bench Press",2,12,105],["Bench Press",3,10,110],
      ["Overhead Press",1,12,60],["Overhead Press",2,12,60],["Overhead Press",3,10,65],
      ["Cable Fly",1,15,35],["Cable Fly",2,15,35],["Cable Fly",3,12,37],
    ],
  },
  {
    date: "2026-04-21", name: "Pull Day", duration: 50,
    sets: [
      ["Lat Pulldown",1,12,100],["Lat Pulldown",2,12,100],["Lat Pulldown",3,10,110],
      ["T-Bar Row",1,12,75],["T-Bar Row",2,12,75],["T-Bar Row",3,10,80],
      ["Hammer Curl",1,15,27],["Hammer Curl",2,15,27],["Hammer Curl",3,12,30],
    ],
  },
  {
    date: "2026-05-05", name: "Legs Day", duration: 60,
    sets: [
      ["Leg Press",1,15,220],["Leg Press",2,15,220],["Leg Press",3,12,240],
      ["Bulgarian Split Squat",1,12,30],["Bulgarian Split Squat",2,12,30],["Bulgarian Split Squat",3,10,35],
      ["Calf Raise",1,20,120],["Calf Raise",2,20,120],["Calf Raise",3,18,130],
    ],
  },
  {
    date: "2026-05-19", name: "Push Day", duration: 55,
    sets: [
      ["Bench Press",1,12,108],["Bench Press",2,12,108],["Bench Press",3,10,110],
      ["Overhead Press",1,12,62],["Overhead Press",2,12,62],["Overhead Press",3,10,65],
      ["Cable Fly",1,15,37],["Cable Fly",2,15,37],["Cable Fly",3,12,40],
    ],
  },
  {
    date: "2026-05-28", name: "Pull Day", duration: 51,
    sets: [
      ["Lat Pulldown",1,12,105],["Lat Pulldown",2,12,105],["Lat Pulldown",3,10,115],
      ["T-Bar Row",1,12,80],["T-Bar Row",2,12,80],["T-Bar Row",3,10,85],
      ["Hammer Curl",1,15,30],["Hammer Curl",2,15,30],["Hammer Curl",3,12,32],
    ],
  },
];

const SAM_NUTRITION_GOALS = (id: number) => [
  { clientId: id, dayType: "training", calories: 1800, protein: 145, carbs: 180, fat: 50, waterOz: 90 },
  { clientId: id, dayType: "rest",     calories: 1600, protein: 140, carbs: 140, fat: 48, waterOz: 80 },
];

const SAM_NUTRITION_LOG_DATES = [
  "2026-02-03","2026-02-06","2026-02-10","2026-02-14","2026-02-20",
  "2026-03-03","2026-03-10","2026-03-17","2026-03-24",
  "2026-04-07","2026-04-14","2026-04-21","2026-04-28",
  "2026-05-05","2026-05-12","2026-05-19","2026-05-26","2026-05-28",
  "2026-06-02","2026-06-04",
];

const SAM_NUTRITION_LOGS = (id: number) => {
  // Dates with MFP screenshots — skip cant_track for those days
  const samMfpDates = new Set(["2026-02-06","2026-03-03","2026-03-17","2026-04-07","2026-05-05","2026-05-28"]);
  return [
    { clientId: id, date: "2026-02-14", imageUrl: "water_only", waterMl: 2130 },
    { clientId: id, date: "2026-04-14", imageUrl: "water_only", waterMl: 2366 },
    ...SAM_NUTRITION_LOG_DATES.filter(d => SAM_WORKOUT_DATES.has(d) && !samMfpDates.has(d)).map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 1790 + Math.round(Math.random() * 40 - 20),
      protein: 143 + Math.round(Math.random() * 6 - 3),
      carbs:   178 + Math.round(Math.random() * 12 - 6),
      fat:      49 + Math.round(Math.random() * 4 - 2),
      waterMl: 2600,
    })),
    ...SAM_NUTRITION_LOG_DATES.filter(d => !SAM_WORKOUT_DATES.has(d) && !samMfpDates.has(d) && d !== "2026-02-14" && d !== "2026-04-14").map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 1590 + Math.round(Math.random() * 40 - 20),
      protein: 138 + Math.round(Math.random() * 6 - 3),
      carbs:   138 + Math.round(Math.random() * 12 - 6),
      fat:      47 + Math.round(Math.random() * 4 - 2),
      waterMl: 2250,
    })),
  ];
};

const SAM_MESSAGES = (id: number) => [
  { clientId: id, sender: "coach",  content: "Hey Sam! Really excited to start working together. How are you feeling about the program so far?", createdAt: new Date("2026-02-04T09:00:00Z") },
  { clientId: id, sender: "client", content: "Super motivated! The push day was tough but I got through it. Felt my chest working for sure.", createdAt: new Date("2026-02-04T18:30:00Z") },
  { clientId: id, sender: "coach",  content: "That's exactly what we want. Remember — the deficit is key. Hit that 1800 on training days and you'll see the scale move.", createdAt: new Date("2026-02-05T09:00:00Z") },
  { clientId: id, sender: "client", content: "Noticed I was 164 this morning — down from 165. Progress!", createdAt: new Date("2026-02-17T08:00:00Z") },
  { clientId: id, sender: "coach",  content: "That's a solid start. We're aiming for 0.5–1 lb/week so you're right on track.", createdAt: new Date("2026-02-17T09:30:00Z") },
  { clientId: id, sender: "client", content: "Sleep has been rough this week. Only getting 6 hours most nights.", createdAt: new Date("2026-03-10T07:30:00Z") },
  { clientId: id, sender: "coach",  content: "Poor sleep will stall fat loss — cortisol stays high and hunger increases. Aim for 7+ even if that means earlier bedtime.", createdAt: new Date("2026-03-10T10:00:00Z") },
  { clientId: id, sender: "client", content: "Took those photos today — wow, big difference from week 1!", createdAt: new Date("2026-03-17T17:00:00Z") },
  { clientId: id, sender: "coach",  content: "You can really see it in your midsection. Strength is going up while weight is going down — that's body recomp happening.", createdAt: new Date("2026-03-18T09:00:00Z") },
  { clientId: id, sender: "client", content: "Down to 159.5! Feeling so much lighter on the Bulgarian split squats too.", createdAt: new Date("2026-04-22T08:00:00Z") },
  { clientId: id, sender: "coach",  content: "Amazing! Halfway to goal weight and you're getting stronger. Let's push for 157 by June.", createdAt: new Date("2026-04-22T09:00:00Z") },
  { clientId: id, sender: "client", content: "Hit 157.4 today 🎉 So close to goal!", createdAt: new Date("2026-06-02T08:00:00Z") },
  { clientId: id, sender: "coach",  content: "Incredible consistency Sam. 8 lbs down in 4 months and still getting stronger. Let's talk next phase.", createdAt: new Date("2026-06-02T10:00:00Z") },
];

const SAM_ASSIGNMENTS = (id: number) => [
  { clientId: id, title: "Log food every day for 2 weeks",      type: "habit", body: "Use the Nutrition tab to track all meals. Consistency builds the habit.", status: "completed", dueDate: "2026-02-17", completedAt: new Date("2026-02-17T20:00:00Z") },
  { clientId: id, title: "Hit water goal 5 out of 7 days",      type: "habit", body: "Aim for 80 oz on rest days and 90 oz on training days.", status: "completed", dueDate: "2026-03-10", completedAt: new Date("2026-03-09T21:00:00Z") },
  { clientId: id, title: "Take mid-point progress photos",      type: "task",  body: "Same pose, same lighting as week 1. Compare them side by side.", status: "completed", dueDate: "2026-03-17", completedAt: new Date("2026-03-17T17:05:00Z") },
  { clientId: id, title: "Stay in calorie deficit all week",    type: "habit", body: "Keep training days at 1800 and rest days at 1600. Log everything.", status: "pending", dueDate: "2026-07-11" },
  { clientId: id, title: "Complete 3 sessions this week",       type: "task",  body: "Push, Pull, and Legs before the week ends.", status: "pending", dueDate: "2026-07-13" },
];

const SAM_CLIENT_TASKS = (id: number) => [
  { clientId: id, text: "Log meals for 3 consecutive days",      status: "completed", dueDate: "2026-02-08", completedAt: new Date("2026-02-07T21:00:00Z") },
  { clientId: id, text: "Complete first full week of training",  status: "completed", dueDate: "2026-02-10", completedAt: new Date("2026-02-10T19:00:00Z") },
  { clientId: id, text: "Reach 163 lbs",                         status: "completed", dueDate: "2026-03-10", completedAt: new Date("2026-03-03T08:00:00Z") },
  { clientId: id, text: "Take 6-week progress photos",           status: "completed", dueDate: "2026-03-17", completedAt: new Date("2026-03-17T17:00:00Z") },
  { clientId: id, text: "Hit 160 lbs",                           status: "completed", dueDate: "2026-04-21", completedAt: new Date("2026-04-21T08:00:00Z") },
  { clientId: id, text: "Log sleep every day for a week",        status: "completed", dueDate: "2026-05-10", completedAt: new Date("2026-05-09T22:00:00Z") },
  { clientId: id, text: "Log today's nutrition",                  status: "accepted", dueDate: "2026-07-27" },
  { clientId: id, text: "Complete this week's pull day",          status: "accepted", dueDate: "2026-07-31" },
  { clientId: id, text: "Send coach a check-in message",         status: "pending",  dueDate: "2026-07-28" },
];

// ─────────────────────────────────────────────────────────────────────────────
// JORDAN — athletic performance (178.5 → 175.3 lbs, 14.2 → 12.5% BF)
// ─────────────────────────────────────────────────────────────────────────────

const JORDAN_MEASUREMENTS = (id: number) => [
  { clientId: id, date: "2026-02-03", weight: "178.5", bodyFat: "14.2", chest: "43.0", waist: "33.5", hips: "38.5", leftArm: "15.8", rightArm: "16.0", leftThigh: "25.0", rightThigh: "25.0", leftCalf: "15.5", rightCalf: "15.5", unit: "imperial" },
  { clientId: id, date: "2026-02-17", weight: "177.8", bodyFat: "13.9", chest: "43.1", waist: "33.2", hips: "38.4", leftArm: "15.9", rightArm: "16.1", leftThigh: "25.0", rightThigh: "25.0", leftCalf: "15.5", rightCalf: "15.6", unit: "imperial" },
  { clientId: id, date: "2026-03-03", weight: "177.2", bodyFat: "13.7", chest: "43.2", waist: "32.9", hips: "38.3", leftArm: "16.0", rightArm: "16.2", leftThigh: "25.1", rightThigh: "25.1", leftCalf: "15.6", rightCalf: "15.6", unit: "imperial" },
  { clientId: id, date: "2026-03-17", weight: "176.8", bodyFat: "13.5", chest: "43.3", waist: "32.7", hips: "38.2", leftArm: "16.0", rightArm: "16.2", leftThigh: "25.1", rightThigh: "25.1", leftCalf: "15.6", rightCalf: "15.7", unit: "imperial" },
  { clientId: id, date: "2026-04-07", weight: "176.3", bodyFat: "13.2", chest: "43.5", waist: "32.4", hips: "38.1", leftArm: "16.1", rightArm: "16.3", leftThigh: "25.2", rightThigh: "25.2", leftCalf: "15.7", rightCalf: "15.7", unit: "imperial" },
  { clientId: id, date: "2026-04-21", weight: "175.9", bodyFat: "13.0", chest: "43.6", waist: "32.2", hips: "38.0", leftArm: "16.2", rightArm: "16.4", leftThigh: "25.2", rightThigh: "25.3", leftCalf: "15.7", rightCalf: "15.8", unit: "imperial" },
  { clientId: id, date: "2026-05-05", weight: "175.6", bodyFat: "12.8", chest: "43.7", waist: "32.0", hips: "37.9", leftArm: "16.2", rightArm: "16.4", leftThigh: "25.3", rightThigh: "25.3", leftCalf: "15.8", rightCalf: "15.8", unit: "imperial" },
  { clientId: id, date: "2026-05-19", weight: "175.4", bodyFat: "12.6", chest: "43.8", waist: "31.8", hips: "37.8", leftArm: "16.3", rightArm: "16.5", leftThigh: "25.3", rightThigh: "25.4", leftCalf: "15.8", rightCalf: "15.9", unit: "imperial" },
  { clientId: id, date: "2026-06-02", weight: "175.3", bodyFat: "12.5", chest: "43.9", waist: "31.6", hips: "37.7", leftArm: "16.4", rightArm: "16.5", leftThigh: "25.4", rightThigh: "25.4", leftCalf: "15.9", rightCalf: "15.9", unit: "imperial" },
];

const JORDAN_SLEEP_LOGS = (id: number) => [
  // Feb
  { clientId: id, date: "2026-02-03", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-06", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-10", hoursSlept: "8.5", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-02-14", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-02-18", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-22", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-02-26", hoursSlept: "8.0", quality: "excellent",  energyRating: 9 },
  // Mar
  { clientId: id, date: "2026-03-03", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-03-07", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-03-12", hoursSlept: "6.5", quality: "fair",      energyRating: 6 },
  { clientId: id, date: "2026-03-17", hoursSlept: "8.5", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-03-22", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-03-27", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  // Apr
  { clientId: id, date: "2026-04-02", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-04-07", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-04-14", hoursSlept: "8.0", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-04-21", hoursSlept: "7.0", quality: "good",      energyRating: 7 },
  { clientId: id, date: "2026-04-28", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  // May
  { clientId: id, date: "2026-05-05", hoursSlept: "8.5", quality: "excellent",  energyRating: 10 },
  { clientId: id, date: "2026-05-12", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-05-19", hoursSlept: "8.0", quality: "good",      energyRating: 9 },
  { clientId: id, date: "2026-05-27", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  // Jun
  { clientId: id, date: "2026-06-02", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-06-05", hoursSlept: "7.5", quality: "good",      energyRating: 8 },
  { clientId: id, date: "2026-06-07", hoursSlept: "8.0", quality: "excellent",  energyRating: 9 },
  { clientId: id, date: "2026-06-10", hoursSlept: "8.5", quality: "excellent",  energyRating: 10 },
  { clientId: id, date: "2026-06-14", hoursSlept: "8.0", quality: "good",      energyRating: 8 },
];

const JORDAN_WORKOUT_DATES = new Set([
  "2026-02-03","2026-02-06","2026-02-10",
  "2026-03-03","2026-03-06","2026-03-17",
  "2026-04-07","2026-04-10","2026-04-21",
  "2026-05-05","2026-05-08","2026-05-19",
]);

const JORDAN_WORKOUT_SESSIONS = [
  {
    date: "2026-02-03", name: "Push Day", duration: 70,
    sets: [
      ["Bench Press",1,5,205],["Bench Press",2,5,205],["Bench Press",3,5,215],["Bench Press",4,3,225],
      ["Overhead Press",1,5,130],["Overhead Press",2,5,130],["Overhead Press",3,5,135],
      ["Cable Fly",1,12,55],["Cable Fly",2,12,55],["Cable Fly",3,10,60],
    ],
  },
  {
    date: "2026-02-06", name: "Pull Day", duration: 68,
    sets: [
      ["Pull-up",1,8,null],["Pull-up",2,8,null],["Pull-up",3,7,null],
      ["T-Bar Row",1,6,155],["T-Bar Row",2,6,155],["T-Bar Row",3,5,165],
      ["Lat Pulldown",1,10,175],["Lat Pulldown",2,10,175],["Lat Pulldown",3,8,185],
      ["Hammer Curl",1,10,55],["Hammer Curl",2,10,55],["Hammer Curl",3,8,60],
    ],
  },
  {
    date: "2026-02-10", name: "Legs Day", duration: 75,
    sets: [
      ["Back Squat",1,5,265],["Back Squat",2,5,265],["Back Squat",3,5,275],["Back Squat",4,3,285],
      ["Deadlift",1,4,315],["Deadlift",2,4,315],["Deadlift",3,3,335],
      ["Leg Press",1,10,500],["Leg Press",2,10,500],["Leg Press",3,8,520],
      ["Calf Raise",1,15,230],["Calf Raise",2,15,230],["Calf Raise",3,12,250],
    ],
  },
  {
    date: "2026-03-03", name: "Push Day", duration: 72,
    sets: [
      ["Bench Press",1,5,210],["Bench Press",2,5,210],["Bench Press",3,5,215],["Bench Press",4,3,225],
      ["Overhead Press",1,5,135],["Overhead Press",2,5,135],["Overhead Press",3,5,140],
      ["Cable Fly",1,12,57],["Cable Fly",2,12,57],["Cable Fly",3,10,62],
    ],
  },
  {
    date: "2026-03-06", name: "Pull Day", duration: 70,
    sets: [
      ["Pull-up",1,9,null],["Pull-up",2,9,null],["Pull-up",3,8,null],
      ["T-Bar Row",1,6,160],["T-Bar Row",2,6,160],["T-Bar Row",3,5,170],
      ["Lat Pulldown",1,10,180],["Lat Pulldown",2,10,180],["Lat Pulldown",3,8,190],
      ["Hammer Curl",1,10,57],["Hammer Curl",2,10,57],["Hammer Curl",3,8,62],
    ],
  },
  {
    date: "2026-03-17", name: "Legs Day", duration: 78,
    sets: [
      ["Back Squat",1,5,275],["Back Squat",2,5,275],["Back Squat",3,5,285],["Back Squat",4,3,295],
      ["Deadlift",1,4,335],["Deadlift",2,4,335],["Deadlift",3,3,355],
      ["Leg Press",1,10,520],["Leg Press",2,10,520],["Leg Press",3,8,540],
      ["Calf Raise",1,15,240],["Calf Raise",2,15,240],["Calf Raise",3,12,260],
    ],
  },
  {
    date: "2026-04-07", name: "Push Day", duration: 73,
    sets: [
      ["Bench Press",1,5,215],["Bench Press",2,5,215],["Bench Press",3,5,220],["Bench Press",4,3,230],
      ["Overhead Press",1,5,137],["Overhead Press",2,5,137],["Overhead Press",3,5,142],
      ["Cable Fly",1,12,60],["Cable Fly",2,12,60],["Cable Fly",3,10,65],
    ],
  },
  {
    date: "2026-04-10", name: "Pull Day", duration: 71,
    sets: [
      ["Pull-up",1,10,null],["Pull-up",2,10,null],["Pull-up",3,9,null],
      ["T-Bar Row",1,6,165],["T-Bar Row",2,6,165],["T-Bar Row",3,5,175],
      ["Lat Pulldown",1,10,185],["Lat Pulldown",2,10,185],["Lat Pulldown",3,8,195],
      ["Hammer Curl",1,10,60],["Hammer Curl",2,10,60],["Hammer Curl",3,8,65],
    ],
  },
  {
    date: "2026-04-21", name: "Legs Day", duration: 80,
    sets: [
      ["Back Squat",1,5,285],["Back Squat",2,5,285],["Back Squat",3,5,295],["Back Squat",4,3,305],
      ["Deadlift",1,4,345],["Deadlift",2,4,345],["Deadlift",3,3,365],
      ["Leg Press",1,10,530],["Leg Press",2,10,530],["Leg Press",3,8,540],
      ["Calf Raise",1,15,250],["Calf Raise",2,15,250],["Calf Raise",3,12,270],
    ],
  },
  {
    date: "2026-05-05", name: "Push Day", duration: 72,
    sets: [
      ["Bench Press",1,5,220],["Bench Press",2,5,220],["Bench Press",3,5,225],["Bench Press",4,3,235],
      ["Overhead Press",1,5,140],["Overhead Press",2,5,140],["Overhead Press",3,5,145],
      ["Cable Fly",1,12,62],["Cable Fly",2,12,62],["Cable Fly",3,10,67],
    ],
  },
  {
    date: "2026-05-08", name: "Pull Day", duration: 69,
    sets: [
      ["Pull-up",1,11,null],["Pull-up",2,10,null],["Pull-up",3,10,null],
      ["T-Bar Row",1,6,170],["T-Bar Row",2,6,170],["T-Bar Row",3,5,180],
      ["Lat Pulldown",1,10,190],["Lat Pulldown",2,10,190],["Lat Pulldown",3,8,200],
      ["Hammer Curl",1,10,62],["Hammer Curl",2,10,62],["Hammer Curl",3,8,67],
    ],
  },
  {
    date: "2026-05-19", name: "Legs Day", duration: 82,
    sets: [
      ["Back Squat",1,5,295],["Back Squat",2,5,295],["Back Squat",3,5,305],["Back Squat",4,3,315],
      ["Deadlift",1,4,355],["Deadlift",2,4,355],["Deadlift",3,3,375],
      ["Leg Press",1,10,540],["Leg Press",2,10,540],["Leg Press",3,8,560],
      ["Calf Raise",1,15,260],["Calf Raise",2,15,260],["Calf Raise",3,12,280],
    ],
  },
];

const JORDAN_NUTRITION_GOALS = (id: number) => [
  { clientId: id, dayType: "training", calories: 2600, protein: 195, carbs: 290, fat: 80, waterOz: 110 },
  { clientId: id, dayType: "rest",     calories: 2400, protein: 190, carbs: 250, fat: 80, waterOz: 100 },
];

const JORDAN_NUTRITION_LOG_DATES = [
  "2026-02-03","2026-02-06","2026-02-10","2026-02-14","2026-02-20",
  "2026-03-03","2026-03-06","2026-03-12","2026-03-17","2026-03-24",
  "2026-04-07","2026-04-10","2026-04-18","2026-04-21","2026-04-28",
  "2026-05-05","2026-05-08","2026-05-14","2026-05-19","2026-05-25",
  "2026-06-01","2026-06-02","2026-06-07",
];

const JORDAN_NUTRITION_LOGS = (id: number) => {
  // Dates with MFP screenshots — skip cant_track for those days
  const jordanMfpDates = new Set(["2026-02-03","2026-03-17","2026-04-21","2026-05-19","2026-06-02"]);
  return [
    { clientId: id, date: "2026-02-14", imageUrl: "water_only", waterMl: 2840 },
    { clientId: id, date: "2026-04-18", imageUrl: "water_only", waterMl: 3000 },
    { clientId: id, date: "2026-05-14", imageUrl: "water_only", waterMl: 3200 },
    ...JORDAN_NUTRITION_LOG_DATES.filter(d => JORDAN_WORKOUT_DATES.has(d) && !jordanMfpDates.has(d)).map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 2580 + Math.round(Math.random() * 60 - 30),
      protein: 193 + Math.round(Math.random() * 8 - 4),
      carbs:   287 + Math.round(Math.random() * 16 - 8),
      fat:      79 + Math.round(Math.random() * 4 - 2),
      waterMl: 3200,
    })),
    ...JORDAN_NUTRITION_LOG_DATES.filter(d => !JORDAN_WORKOUT_DATES.has(d) && !jordanMfpDates.has(d) && !["2026-02-14","2026-04-18","2026-05-14"].includes(d)).map(date => ({
      clientId: id, date, imageUrl: "cant_track",
      calories: 2380 + Math.round(Math.random() * 60 - 30),
      protein: 188 + Math.round(Math.random() * 8 - 4),
      carbs:   247 + Math.round(Math.random() * 16 - 8),
      fat:      79 + Math.round(Math.random() * 4 - 2),
      waterMl: 2840,
    })),
  ];
};

const JORDAN_MESSAGES = (id: number) => [
  { clientId: id, sender: "coach",  content: "Jordan, stoked to work with you on this performance program. What are your main goals — strength numbers or sport performance?", createdAt: new Date("2026-02-04T09:30:00Z") },
  { clientId: id, sender: "client", content: "Both really. Want to hit a 315 bench, 400+ squat, and get my body fat under 13%. Competing in a local powerlifting meet in September.", createdAt: new Date("2026-02-04T12:00:00Z") },
  { clientId: id, sender: "coach",  content: "Love it. We'll train specifically for that. Keep your calories at 2600 on training days and sleep 8+ — that's non-negotiable for a performance athlete.", createdAt: new Date("2026-02-05T09:00:00Z") },
  { clientId: id, sender: "client", content: "Hit 275 for 5 on squat today. Feeling strong.", createdAt: new Date("2026-03-17T20:00:00Z") },
  { clientId: id, sender: "coach",  content: "That's a 10 lb increase in 6 weeks. Linear progression is working perfectly. How's recovery feeling?", createdAt: new Date("2026-03-18T09:00:00Z") },
  { clientId: id, sender: "client", content: "Great actually. Sleep has been solid. I've been strict about the 8 hours.", createdAt: new Date("2026-03-18T12:00:00Z") },
  { clientId: id, sender: "coach",  content: "It shows. Your pull-up reps are climbing fast — 10 unweighted sets now. Once we hit 12 we'll add a 10 lb belt.", createdAt: new Date("2026-04-11T09:00:00Z") },
  { clientId: id, sender: "client", content: "305 for a set of 5 on squat! Body fat must be dropping too, waist feels way tighter.", createdAt: new Date("2026-04-21T21:00:00Z") },
  { clientId: id, sender: "coach",  content: "You're below 13% now. The body recomp is working — gaining muscle while trimming fat because your nutrition is so dialled in.", createdAt: new Date("2026-04-22T09:00:00Z") },
  { clientId: id, sender: "client", content: "315 for 3 on squat today. Inching toward 400 🔥", createdAt: new Date("2026-05-19T20:30:00Z") },
  { clientId: id, sender: "coach",  content: "Ahead of schedule. If you keep this trajectory you'll comfortably hit 365+ at the meet. Deadlift is looking like your biggest PR opportunity.", createdAt: new Date("2026-05-20T09:00:00Z") },
  { clientId: id, sender: "client", content: "375 deadlift for 3 yesterday. Felt like I had more in the tank.", createdAt: new Date("2026-05-20T12:00:00Z") },
  { clientId: id, sender: "coach",  content: "Don't grind it in training — save the max for the meet. Let's taper properly in August. You're in great shape.", createdAt: new Date("2026-05-20T13:00:00Z") },
];

const JORDAN_ASSIGNMENTS = (id: number) => [
  { clientId: id, title: "Track macros every training day",        type: "habit", body: "Hit the 2600 kcal and 195g protein target on every session day. Log it all.", status: "completed", dueDate: "2026-02-28", completedAt: new Date("2026-02-27T21:00:00Z") },
  { clientId: id, title: "Achieve 8h sleep 5 nights/week",         type: "habit", body: "Sleep is your recovery tool. Log quality each morning.", status: "completed", dueDate: "2026-03-15", completedAt: new Date("2026-03-14T22:00:00Z") },
  { clientId: id, title: "Hit a squat PR",                          type: "task",  body: "Log a new 5-rep max on back squat, heavier than your last best.", status: "completed", dueDate: "2026-04-30", completedAt: new Date("2026-04-21T21:00:00Z") },
  { clientId: id, title: "Log every workout session this month",   type: "habit", body: "Use the workout tracker for all sessions — sets, reps, and weight.", status: "pending", dueDate: "2026-07-31" },
  { clientId: id, title: "Hit a deadlift PR before August",        type: "task",  body: "Target 395+ lbs for 1 rep before the taper begins.", status: "pending", dueDate: "2026-07-31" },
];

const SAM_PHOTO_FILES = [
  { file: "progress-front-week1.png", date: "2026-02-03", notes: "Week 1 — front" },
  { file: "progress-front-week6.png", date: "2026-03-17", notes: "Week 6 — front" },
  { file: "progress-back-week6.png",  date: "2026-03-17", notes: "Week 6 — back"  },
];

const JORDAN_PHOTO_FILES = [
  { file: "progress-front-week1.png", date: "2026-02-03", notes: "Week 1 — front" },
  { file: "progress-front-week6.png", date: "2026-03-17", notes: "Week 6 — front" },
  { file: "progress-back-week6.png",  date: "2026-03-17", notes: "Week 6 — back"  },
];

const JORDAN_CLIENT_TASKS = (id: number) => [
  { clientId: id, text: "Complete first full training week",         status: "completed", dueDate: "2026-02-10", completedAt: new Date("2026-02-10T20:00:00Z") },
  { clientId: id, text: "Squat 275 lbs for 5 reps",                 status: "completed", dueDate: "2026-03-31", completedAt: new Date("2026-03-17T20:00:00Z") },
  { clientId: id, text: "Drop below 13% body fat",                   status: "completed", dueDate: "2026-05-01", completedAt: new Date("2026-04-21T08:00:00Z") },
  { clientId: id, text: "Hit 300+ lb squat for reps",               status: "completed", dueDate: "2026-05-05", completedAt: new Date("2026-04-21T20:00:00Z") },
  { clientId: id, text: "Log sleep 7 nights in a row",              status: "completed", dueDate: "2026-04-15", completedAt: new Date("2026-04-14T22:00:00Z") },
  { clientId: id, text: "Hit 375 lb deadlift for 3",                status: "completed", dueDate: "2026-05-31", completedAt: new Date("2026-05-19T20:30:00Z") },
  { clientId: id, text: "Log today's nutrition",                     status: "accepted", dueDate: "2026-07-27" },
  { clientId: id, text: "Complete this week's legs session",         status: "accepted", dueDate: "2026-07-31" },
  { clientId: id, text: "Record a new squat video for coach review", status: "pending",  dueDate: "2026-07-30" },
];

// ── MFP screenshot seed data ──────────────────────────────────────────────────
// imageFile references files in attached_assets/seed/
// macros reflect AI-extracted values shown by the screenshot
interface MfpScreenshotEntry {
  date: string;
  imageFile: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

// Alex — muscle building, PPL program (~2800 kcal training / ~2400 rest)
const ALEX_MFP_SCREENSHOTS: MfpScreenshotEntry[] = [
  { date: "2026-02-03", imageFile: "mfp-day1.png", calories: 2820, protein: 212, carbs: 298, fat: 67, notes: "Training day — full diary" },
  { date: "2026-03-03", imageFile: "mfp-day2.png", calories: 2762, protein: 207, carbs: 292, fat: 65, notes: "Training day — full diary" },
  { date: "2026-04-07", imageFile: "mfp-day3.png", calories: 2795, protein: 210, carbs: 295, fat: 68, notes: "Training day — full diary" },
  { date: "2026-05-19", imageFile: "mfp-day4.png", calories: 2800, protein: 208, carbs: 298, fat: 66, notes: "Training day — full diary" },
  { date: "2026-06-04", imageFile: "mfp-day2.png", calories: 2835, protein: 214, carbs: 303, fat: 67, notes: "Training day — full diary" },
];

// Sam — fat loss / cardio, lower-calorie deficit (~1800 training / ~1600 rest)
const SAM_MFP_SCREENSHOTS: MfpScreenshotEntry[] = [
  { date: "2026-02-06", imageFile: "mfp-day5.png", calories: 1803, protein: 143, carbs: 191, fat: 52, notes: "Training day — calorie deficit" },
  { date: "2026-03-03", imageFile: "mfp-day4.png", calories: 1820, protein: 146, carbs: 195, fat: 53, notes: "Training day — full diary" },
  { date: "2026-03-17", imageFile: "mfp-day1.png", calories: 1809, protein: 144, carbs: 192, fat: 52, notes: "Training day — full diary" },
  { date: "2026-04-07", imageFile: "mfp-day2.png", calories: 1796, protein: 142, carbs: 188, fat: 51, notes: "Training day — full diary" },
  { date: "2026-05-05", imageFile: "mfp-day5.png", calories: 1812, protein: 145, carbs: 193, fat: 53, notes: "Training day — full diary" },
  { date: "2026-05-28", imageFile: "mfp-day3.png", calories: 1798, protein: 141, carbs: 187, fat: 51, notes: "Training day — full diary" },
];

// Jordan — athletic performance (~2600 kcal training / ~2400 rest)
const JORDAN_MFP_SCREENSHOTS: MfpScreenshotEntry[] = [
  { date: "2026-02-03", imageFile: "mfp-day4.png", calories: 2592, protein: 194, carbs: 289, fat: 80, notes: "Training day — full diary" },
  { date: "2026-03-17", imageFile: "mfp-day2.png", calories: 2607, protein: 196, carbs: 292, fat: 80, notes: "Training day — full diary" },
  { date: "2026-04-21", imageFile: "mfp-day5.png", calories: 2618, protein: 195, carbs: 293, fat: 80, notes: "Training day — full diary" },
  { date: "2026-05-19", imageFile: "mfp-day1.png", calories: 2599, protein: 193, carbs: 287, fat: 79, notes: "Training day — full diary" },
  { date: "2026-06-02", imageFile: "mfp-day3.png", calories: 2415, protein: 191, carbs: 252, fat: 80, notes: "Rest day — full diary" },
];

// ── Photo upload helper ───────────────────────────────────────────────────────
async function uploadSeedPhoto(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const uuid = randomUUID();
  const objectName = `${PRIVATE_PREFIX}/${uuid}`;
  const bucket = objectStorageClient.bucket(BUCKET);
  const file = bucket.file(objectName);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  await file.save(buffer, { contentType, resumable: false });
  return `/api/storage/objects/uploads/${uuid}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  // Shared seed directory and MFP image upload cache
  const seedDir = path.resolve(process.cwd(), "../../attached_assets/seed");
  const mfpImageCache = new Map<string, string>();
  async function uploadMfpImage(filename: string): Promise<string> {
    if (mfpImageCache.has(filename)) return mfpImageCache.get(filename)!;
    const filePath = path.join(seedDir, filename);
    if (!fs.existsSync(filePath)) throw new Error(`MFP seed image not found: ${filePath}`);
    const url = await uploadSeedPhoto(filePath);
    mfpImageCache.set(filename, url);
    return url;
  }

  console.log("Wiping all existing coaches and clients...");
  await db.delete(programAssignmentHistoryTable);
  await db.delete(programAssignmentsTable);
  await db.delete(coachesTable);

  console.log("Creating demo coach...");
  const coachHash = await bcrypt.hash(COACH.password, SALT_ROUNDS);
  const [coach] = await db.insert(coachesTable).values({
    username: COACH.username,
    passwordHash: coachHash,
    name: COACH.name,
    email: COACH.email,
  }).returning();
  console.log(`  Created coach: ${COACH.username} / ${COACH.password} (id=${coach.id})`);

  console.log("Creating demo clients...");
  const createdClients: { username: string; id: number }[] = [];
  for (const c of CLIENTS) {
    const hash = await bcrypt.hash(c.password, SALT_ROUNDS);
    const [client] = await db.insert(clientsTable).values({
      coachId: coach.id,
      username: c.username,
      passwordHash: hash,
      name: c.name,
      email: c.email,
      goal: c.goal,
    }).returning();
    console.log(`  Created client: ${c.username} / ${c.password} (id=${client.id})`);
    createdClients.push({ username: c.username, id: client.id });
  }

  console.log("Populating 5 pre-built programs for the demo coach...");
  await instantiateAllProgramTemplatesForCoach(coach.id);
  console.log("  Done.");

  // ── Seed data for Alex ─────────────────────────────────────────────────────
  const alexId = createdClients.find(c => c.username === "alex")!.id;
  console.log(`\nSeeding demo data for Alex (id=${alexId})...`);

  // 0. Measurements (with body fat)
  await db.insert(measurementsTable).values(MEASUREMENTS(alexId));
  console.log(`  ✓ ${MEASUREMENTS(alexId).length} measurements (with body fat %)`);

  // 0. Sleep logs (extended Feb–Jun)
  await db.insert(sleepLogsTable).values(SLEEP_LOGS(alexId));
  console.log(`  ✓ ${SLEEP_LOGS(alexId).length} sleep logs (Feb–Jun)`);

  // 1. Program assignment — pick coach's first program (PPL)
  const coachPrograms = await db.select().from(programsTable).where(eq(programsTable.coachId, coach.id));
  const pplProgram = coachPrograms.find(p => p.name.toLowerCase().includes("ppl") || p.name.toLowerCase().includes("push")) ?? coachPrograms[0];
  if (pplProgram) {
    await db.insert(programAssignmentsTable).values({
      clientId: alexId,
      programId: pplProgram.id,
      startDate: "2026-02-03",
    });
    await db.insert(programAssignmentHistoryTable).values({
      clientId: alexId,
      programId: pplProgram.id,
      programName: pplProgram.name,
      startDate: "2026-02-03",
    });
    console.log(`  ✓ Program assigned: "${pplProgram.name}" (id=${pplProgram.id})`);
  } else {
    console.warn("  ⚠ No programs found for coach — skipping program assignment.");
  }

  // 2. Nutrition goals
  await db.insert(nutritionGoalsTable).values(NUTRITION_GOALS(alexId));
  console.log(`  ✓ ${NUTRITION_GOALS(alexId).length} nutrition goals (training + rest day)`);

  // 3. Nutrition logs
  const nutritionRows = NUTRITION_LOGS(alexId);
  await db.insert(nutritionLogsTable).values(nutritionRows as any);
  console.log(`  ✓ ${nutritionRows.length} nutrition logs`);

  // 3b. MFP screenshot entries for Alex
  {
    let mfpCount = 0;
    for (const entry of ALEX_MFP_SCREENSHOTS) {
      try {
        const imageUrl = await uploadMfpImage(entry.imageFile);
        await db.insert(nutritionLogsTable).values({
          clientId: alexId,
          date: entry.date,
          imageUrl,
          calories: entry.calories,
          protein: String(entry.protein),
          carbs: String(entry.carbs),
          fat: String(entry.fat),
          notes: entry.notes ?? null,
        });
        mfpCount++;
      } catch (err) {
        console.warn(`  ⚠ MFP screenshot failed for Alex ${entry.date}:`, err);
      }
    }
    console.log(`  ✓ ${mfpCount}/${ALEX_MFP_SCREENSHOTS.length} MFP screenshot entries`);
  }

  // 4. Messages
  await db.insert(messagesTable).values(MESSAGES(alexId) as any);
  console.log(`  ✓ ${MESSAGES(alexId).length} messages`);

  // 5. Assignments
  await db.insert(assignmentsTable).values(ASSIGNMENTS(alexId) as any);
  console.log(`  ✓ ${ASSIGNMENTS(alexId).length} assignments`);

  // 6. Client tasks (completed + pending)
  await db.insert(clientTasksTable).values(CLIENT_TASKS(alexId) as any);
  console.log(`  ✓ ${CLIENT_TASKS(alexId).length} client tasks (6 completed, 3 pending)`);

  // Workout logs — exercise ID lookup required
  const allExercises = await db.select().from(exercisesTable);
  if (allExercises.length === 0) {
    console.warn("  ⚠ No exercises in DB — skipping workout logs. Start the server once first, then re-run.");
  } else {
    const exMap: Record<string, number> = {};
    for (const ex of allExercises) exMap[ex.name] = ex.id;
    let workoutCount = 0, setCount = 0;
    for (const session of WORKOUT_SESSIONS) {
      const [log] = await db.insert(workoutLogsTable).values({
        clientId: alexId,
        programDayName: session.name,
        date: session.date,
        durationMinutes: session.duration,
        status: "completed",
      }).returning();
      const setRows = session.sets
        .filter(([exName]) => exMap[exName as string] !== undefined)
        .map(([exName, setNum, reps, weight]) => ({
          workoutLogId: log.id,
          exerciseId: exMap[exName as string],
          exerciseName: exName as string,
          setNumber: setNum as number,
          reps: reps as number,
          weight: weight !== null ? String(weight) : null,
          weightUnit: weight !== null ? "lbs" : null,
        }));
      if (setRows.length > 0) await db.insert(setLogsTable).values(setRows);
      workoutCount++;
      setCount += setRows.length;
    }
    console.log(`  ✓ ${workoutCount} workout sessions, ${setCount} set logs`);
  }

  // Progress photos
  let photoCount = 0;
  for (const { file, date, notes } of PHOTO_FILES) {
    const filePath = path.join(seedDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ Seed photo not found: ${filePath} — skipping`);
      continue;
    }
    try {
      const imageUrl = await uploadSeedPhoto(filePath);
      await db.insert(progressPhotosTable).values({ clientId: alexId, date, imageUrl, notes });
      photoCount++;
    } catch (err) {
      console.warn(`  ⚠ Failed to upload ${file}:`, err);
    }
  }
  console.log(`  ✓ ${photoCount}/${PHOTO_FILES.length} progress photos`);

  // ── Seed data for Sam ─────────────────────────────────────────────────────
  const samId = createdClients.find(c => c.username === "sam")!.id;
  console.log(`\nSeeding demo data for Sam (id=${samId})...`);

  await db.insert(measurementsTable).values(SAM_MEASUREMENTS(samId));
  console.log(`  ✓ ${SAM_MEASUREMENTS(samId).length} measurements`);

  await db.insert(sleepLogsTable).values(SAM_SLEEP_LOGS(samId));
  console.log(`  ✓ ${SAM_SLEEP_LOGS(samId).length} sleep logs`);

  // Pick second program for Sam (fat loss/weight focus)
  const samProgram = coachPrograms.find(p =>
    p.name.toLowerCase().includes("weight") ||
    p.name.toLowerCase().includes("fat") ||
    p.name.toLowerCase().includes("loss") ||
    p.name.toLowerCase().includes("lean")
  ) ?? coachPrograms[1] ?? coachPrograms[0];
  if (samProgram) {
    await db.insert(programAssignmentsTable).values({ clientId: samId, programId: samProgram.id, startDate: "2026-02-03" });
    await db.insert(programAssignmentHistoryTable).values({ clientId: samId, programId: samProgram.id, programName: samProgram.name, startDate: "2026-02-03" });
    console.log(`  ✓ Program assigned: "${samProgram.name}"`);
  }

  await db.insert(nutritionGoalsTable).values(SAM_NUTRITION_GOALS(samId));
  const samNutritionRows = SAM_NUTRITION_LOGS(samId);
  await db.insert(nutritionLogsTable).values(samNutritionRows as any);
  console.log(`  ✓ ${SAM_NUTRITION_GOALS(samId).length} nutrition goals, ${samNutritionRows.length} logs`);

  // MFP screenshot entries for Sam
  {
    let mfpCount = 0;
    for (const entry of SAM_MFP_SCREENSHOTS) {
      try {
        const imageUrl = await uploadMfpImage(entry.imageFile);
        await db.insert(nutritionLogsTable).values({
          clientId: samId,
          date: entry.date,
          imageUrl,
          calories: entry.calories,
          protein: String(entry.protein),
          carbs: String(entry.carbs),
          fat: String(entry.fat),
          notes: entry.notes ?? null,
        });
        mfpCount++;
      } catch (err) {
        console.warn(`  ⚠ MFP screenshot failed for Sam ${entry.date}:`, err);
      }
    }
    console.log(`  ✓ ${mfpCount}/${SAM_MFP_SCREENSHOTS.length} MFP screenshot entries`);
  }

  await db.insert(messagesTable).values(SAM_MESSAGES(samId) as any);
  console.log(`  ✓ ${SAM_MESSAGES(samId).length} messages`);

  await db.insert(assignmentsTable).values(SAM_ASSIGNMENTS(samId) as any);
  await db.insert(clientTasksTable).values(SAM_CLIENT_TASKS(samId) as any);
  console.log(`  ✓ ${SAM_ASSIGNMENTS(samId).length} assignments, ${SAM_CLIENT_TASKS(samId).length} tasks`);

  if (allExercises.length > 0) {
    let samWorkoutCount = 0, samSetCount = 0;
    const exMap2: Record<string, number> = {};
    for (const ex of allExercises) exMap2[ex.name] = ex.id;
    for (const session of SAM_WORKOUT_SESSIONS) {
      const [log] = await db.insert(workoutLogsTable).values({
        clientId: samId, programDayName: session.name, date: session.date,
        durationMinutes: session.duration, status: "completed",
      }).returning();
      const setRows = session.sets
        .filter(([exName]) => exMap2[exName as string] !== undefined)
        .map(([exName, setNum, reps, weight]) => ({
          workoutLogId: log.id, exerciseId: exMap2[exName as string],
          exerciseName: exName as string, setNumber: setNum as number,
          reps: reps as number,
          weight: weight !== null ? String(weight) : null,
          weightUnit: weight !== null ? "lbs" : null,
        }));
      if (setRows.length > 0) await db.insert(setLogsTable).values(setRows);
      samWorkoutCount++; samSetCount += setRows.length;
    }
    console.log(`  ✓ ${samWorkoutCount} workout sessions, ${samSetCount} set logs`);
  }

  // Sam progress photos
  let samPhotoCount = 0;
  for (const { file, date, notes } of SAM_PHOTO_FILES) {
    const filePath = path.join(seedDir, file);
    if (!fs.existsSync(filePath)) { console.warn(`  ⚠ Seed photo not found: ${filePath} — skipping`); continue; }
    try {
      const imageUrl = await uploadSeedPhoto(filePath);
      await db.insert(progressPhotosTable).values({ clientId: samId, date, imageUrl, notes });
      samPhotoCount++;
    } catch (err) { console.warn(`  ⚠ Failed to upload ${file}:`, err); }
  }
  console.log(`  ✓ ${samPhotoCount}/${SAM_PHOTO_FILES.length} progress photos`);

  // ── Seed data for Jordan ───────────────────────────────────────────────────
  const jordanId = createdClients.find(c => c.username === "jordan")!.id;
  console.log(`\nSeeding demo data for Jordan (id=${jordanId})...`);

  await db.insert(measurementsTable).values(JORDAN_MEASUREMENTS(jordanId));
  console.log(`  ✓ ${JORDAN_MEASUREMENTS(jordanId).length} measurements`);

  await db.insert(sleepLogsTable).values(JORDAN_SLEEP_LOGS(jordanId));
  console.log(`  ✓ ${JORDAN_SLEEP_LOGS(jordanId).length} sleep logs`);

  const jordanProgram = coachPrograms.find(p =>
    p.name.toLowerCase().includes("strength") ||
    p.name.toLowerCase().includes("power") ||
    p.name.toLowerCase().includes("perf") ||
    p.name.toLowerCase().includes("athlete")
  ) ?? coachPrograms[2] ?? coachPrograms[0];
  if (jordanProgram) {
    await db.insert(programAssignmentsTable).values({ clientId: jordanId, programId: jordanProgram.id, startDate: "2026-02-03" });
    await db.insert(programAssignmentHistoryTable).values({ clientId: jordanId, programId: jordanProgram.id, programName: jordanProgram.name, startDate: "2026-02-03" });
    console.log(`  ✓ Program assigned: "${jordanProgram.name}"`);
  }

  await db.insert(nutritionGoalsTable).values(JORDAN_NUTRITION_GOALS(jordanId));
  const jordanNutritionRows = JORDAN_NUTRITION_LOGS(jordanId);
  await db.insert(nutritionLogsTable).values(jordanNutritionRows as any);
  console.log(`  ✓ ${JORDAN_NUTRITION_GOALS(jordanId).length} nutrition goals, ${jordanNutritionRows.length} logs`);

  // MFP screenshot entries for Jordan
  {
    let mfpCount = 0;
    for (const entry of JORDAN_MFP_SCREENSHOTS) {
      try {
        const imageUrl = await uploadMfpImage(entry.imageFile);
        await db.insert(nutritionLogsTable).values({
          clientId: jordanId,
          date: entry.date,
          imageUrl,
          calories: entry.calories,
          protein: String(entry.protein),
          carbs: String(entry.carbs),
          fat: String(entry.fat),
          notes: entry.notes ?? null,
        });
        mfpCount++;
      } catch (err) {
        console.warn(`  ⚠ MFP screenshot failed for Jordan ${entry.date}:`, err);
      }
    }
    console.log(`  ✓ ${mfpCount}/${JORDAN_MFP_SCREENSHOTS.length} MFP screenshot entries`);
  }

  await db.insert(messagesTable).values(JORDAN_MESSAGES(jordanId) as any);
  console.log(`  ✓ ${JORDAN_MESSAGES(jordanId).length} messages`);

  await db.insert(assignmentsTable).values(JORDAN_ASSIGNMENTS(jordanId) as any);
  await db.insert(clientTasksTable).values(JORDAN_CLIENT_TASKS(jordanId) as any);
  console.log(`  ✓ ${JORDAN_ASSIGNMENTS(jordanId).length} assignments, ${JORDAN_CLIENT_TASKS(jordanId).length} tasks`);

  if (allExercises.length > 0) {
    let jordanWorkoutCount = 0, jordanSetCount = 0;
    const exMap3: Record<string, number> = {};
    for (const ex of allExercises) exMap3[ex.name] = ex.id;
    for (const session of JORDAN_WORKOUT_SESSIONS) {
      const [log] = await db.insert(workoutLogsTable).values({
        clientId: jordanId, programDayName: session.name, date: session.date,
        durationMinutes: session.duration, status: "completed",
      }).returning();
      const setRows = session.sets
        .filter(([exName]) => exMap3[exName as string] !== undefined)
        .map(([exName, setNum, reps, weight]) => ({
          workoutLogId: log.id, exerciseId: exMap3[exName as string],
          exerciseName: exName as string, setNumber: setNum as number,
          reps: reps as number,
          weight: weight !== null ? String(weight) : null,
          weightUnit: weight !== null ? "lbs" : null,
        }));
      if (setRows.length > 0) await db.insert(setLogsTable).values(setRows);
      jordanWorkoutCount++; jordanSetCount += setRows.length;
    }
    console.log(`  ✓ ${jordanWorkoutCount} workout sessions, ${jordanSetCount} set logs`);
  }

  // Jordan progress photos
  let jordanPhotoCount = 0;
  for (const { file, date, notes } of JORDAN_PHOTO_FILES) {
    const filePath = path.join(seedDir, file);
    if (!fs.existsSync(filePath)) { console.warn(`  ⚠ Seed photo not found: ${filePath} — skipping`); continue; }
    try {
      const imageUrl = await uploadSeedPhoto(filePath);
      await db.insert(progressPhotosTable).values({ clientId: jordanId, date, imageUrl, notes });
      jordanPhotoCount++;
    } catch (err) { console.warn(`  ⚠ Failed to upload ${file}:`, err); }
  }
  console.log(`  ✓ ${jordanPhotoCount}/${JORDAN_PHOTO_FILES.length} progress photos`);

  console.log("\n✅ Seed complete.");
  console.log("\nDemo credentials:");
  console.log("  Coach:    coach / coach");
  console.log("  Client 1: alex / alex");
  console.log("  Client 2: sam / sam");
  console.log("  Client 3: jordan / jordan");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
