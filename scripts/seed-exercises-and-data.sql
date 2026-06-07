-- ── 1. Fix existing exercises ─────────────────────────────────────────────────
UPDATE exercises SET muscle_group = 'Legs', is_compound = true  WHERE name = 'Deadlift';
UPDATE exercises SET is_compound = true  WHERE name IN (
  'Pull-up','Barbell Bench Press','Incline Dumbbell Press','Back Squat',
  'Romanian Deadlift','Leg Press','Overhead Press'
);

-- ── 2. Add new exercises ──────────────────────────────────────────────────────
INSERT INTO exercises (name, muscle_group, is_compound) VALUES
  ('Cable Fly','Chest',false),('Dumbbell Fly','Chest',false),('Push-Up','Chest',false),
  ('Dips','Chest',false),('Pec Deck','Chest',false),('Low Cable Crossover','Chest',false),
  ('Barbell Row','Back',true),('Seated Cable Row','Back',false),('Lat Pulldown','Back',false),
  ('T-Bar Row','Back',true),('Face Pull','Back',false),('Straight-Arm Pulldown','Back',false),
  ('Single-Arm Dumbbell Row','Back',false),
  ('Bulgarian Split Squat','Legs',false),('Leg Curl','Legs',false),('Leg Extension','Legs',false),
  ('Walking Lunge','Legs',false),('Unilateral Leg Curl','Legs',false),('Unilateral Leg Extension','Legs',false),
  ('Hip Thrust','Legs',true),('Calf Raise','Legs',false),('Unilateral Calf Raise','Legs',false),
  ('Hack Squat','Legs',true),('Sumo Deadlift','Legs',true),
  ('Glute Bridge','Glutes',false),('Cable Kickback','Glutes',false),('Unilateral Cable Kickback','Glutes',false),
  ('Hip Abduction','Glutes',false),('Donkey Kick','Glutes',false),
  ('Arnold Press','Shoulders',false),('Unilateral Dumbbell Lateral Raise','Shoulders',false),
  ('Rear Delt Fly','Shoulders',false),('Cable Lateral Raise','Shoulders',false),
  ('Unilateral Cable Lateral Raise','Shoulders',false),
  ('Hammer Curl','Biceps',false),('Unilateral Hammer Curl','Biceps',false),
  ('Unilateral Dumbbell Curl','Biceps',false),('Barbell Curl','Biceps',false),
  ('Preacher Curl','Biceps',false),('Cable Curl','Biceps',false),
  ('Skull Crushers','Triceps',false),('Overhead Tricep Extension','Triceps',false),
  ('Unilateral Overhead Tricep Extension','Triceps',false),('Close-Grip Bench Press','Triceps',true),
  ('Dips (Tricep)','Triceps',false),('Cable Overhead Extension','Triceps',false),
  ('Hanging Leg Raise','Core',false),('Ab Wheel Rollout','Core',false),
  ('Russian Twist','Core',false),('Side Plank','Core',false),('Dead Bug','Core',false)
ON CONFLICT DO NOTHING;

-- ── 3. Measurements for Alex Johnson (client_id=1) ────────────────────────────
INSERT INTO measurements (client_id, date, weight, chest, waist, hips, left_arm, right_arm, left_thigh, right_thigh, left_calf, right_calf, unit) VALUES
  (1,'2026-02-03',191.5,44.5,36.5,40.0,15.2,15.4,24.5,24.5,15.0,15.0,'imperial'),
  (1,'2026-02-17',189.8,44.2,36.0,39.8,15.3,15.4,24.4,24.5,15.0,15.1,'imperial'),
  (1,'2026-03-03',188.4,43.8,35.5,39.5,15.4,15.5,24.3,24.4,15.1,15.1,'imperial'),
  (1,'2026-03-17',187.1,43.5,35.2,39.2,15.5,15.6,24.2,24.3,15.1,15.2,'imperial'),
  (1,'2026-04-07',185.9,43.2,34.8,39.0,15.6,15.7,24.0,24.1,15.2,15.2,'imperial'),
  (1,'2026-04-21',184.5,42.8,34.5,38.7,15.7,15.8,23.9,24.0,15.2,15.3,'imperial'),
  (1,'2026-05-05',183.2,42.5,34.0,38.5,15.8,15.9,23.8,23.9,15.3,15.3,'imperial'),
  (1,'2026-05-19',182.1,42.2,33.8,38.2,15.9,16.0,23.7,23.8,15.3,15.4,'imperial'),
  (1,'2026-06-02',180.8,42.0,33.5,38.0,16.0,16.1,23.6,23.7,15.4,15.4,'imperial');

-- ── 4. Sleep logs ─────────────────────────────────────────────────────────────
INSERT INTO sleep_logs (client_id, date, hours_slept, quality, energy_rating) VALUES
  (1,'2026-05-25',7.5,'great',9),(1,'2026-05-26',6.5,'good',7),(1,'2026-05-27',8.0,'great',9),
  (1,'2026-05-28',7.0,'good',7),(1,'2026-05-29',5.5,'fair',5),(1,'2026-05-30',9.0,'great',10),
  (1,'2026-05-31',7.5,'good',8),(1,'2026-06-01',6.0,'fair',6),(1,'2026-06-02',8.5,'great',9),
  (1,'2026-06-03',7.0,'good',8),(1,'2026-06-04',4.5,'poor',3),(1,'2026-06-05',9.5,'great',10),
  (1,'2026-06-06',7.5,'good',8);

-- ── 5. Helper: insert sets for a workout log ──────────────────────────────────
-- Pattern: FROM wl CROSS JOIN (VALUES ...) AS s JOIN exercises e ON e.name = s.exname

-- May 19 — Push Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-19','Push Day',68,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Barbell Bench Press',1,8,185),('Barbell Bench Press',2,8,185),('Barbell Bench Press',3,6,195),('Barbell Bench Press',4,6,195),
  ('Incline Dumbbell Press',1,10,70),('Incline Dumbbell Press',2,10,70),('Incline Dumbbell Press',3,9,75),
  ('Overhead Press',1,10,115),('Overhead Press',2,9,115),('Overhead Press',3,8,120),
  ('Tricep Pushdown',1,12,60),('Tricep Pushdown',2,12,60),('Tricep Pushdown',3,10,65),
  ('Dumbbell Fly',1,12,40),('Dumbbell Fly',2,12,40),('Dumbbell Fly',3,10,45)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- May 21 — Pull Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-21','Pull Day',72,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Pull-up',1,8,NULL),('Pull-up',2,7,NULL),('Pull-up',3,6,NULL),
  ('Barbell Row',1,8,185),('Barbell Row',2,8,185),('Barbell Row',3,8,195),
  ('Lat Pulldown',1,12,150),('Lat Pulldown',2,12,150),('Lat Pulldown',3,10,160),
  ('Dumbbell Curl',1,12,40),('Dumbbell Curl',2,12,40),('Dumbbell Curl',3,10,45),
  ('Face Pull',1,15,50),('Face Pull',2,15,50),('Face Pull',3,12,55)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- May 23 — Legs Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-23','Legs Day',75,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Back Squat',1,8,225),('Back Squat',2,8,225),('Back Squat',3,6,245),('Back Squat',4,6,245),
  ('Romanian Deadlift',1,10,185),('Romanian Deadlift',2,10,185),('Romanian Deadlift',3,8,205),
  ('Leg Press',1,12,360),('Leg Press',2,12,360),('Leg Press',3,10,400),
  ('Leg Curl',1,12,100),('Leg Curl',2,12,100),('Leg Curl',3,10,110),
  ('Calf Raise',1,15,180),('Calf Raise',2,15,180),('Calf Raise',3,15,200)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- May 26 — Push Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-26','Push Day',65,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Barbell Bench Press',1,8,190),('Barbell Bench Press',2,8,190),('Barbell Bench Press',3,6,200),('Barbell Bench Press',4,5,200),
  ('Incline Dumbbell Press',1,10,72),('Incline Dumbbell Press',2,10,72),('Incline Dumbbell Press',3,9,75),
  ('Overhead Press',1,10,120),('Overhead Press',2,9,120),('Overhead Press',3,8,125),
  ('Tricep Pushdown',1,12,65),('Tricep Pushdown',2,12,65),('Tricep Pushdown',3,10,70),
  ('Pec Deck',1,12,130),('Pec Deck',2,12,130),('Pec Deck',3,10,140)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- May 28 — Pull Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-28','Pull Day',70,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Pull-up',1,9,NULL),('Pull-up',2,8,NULL),('Pull-up',3,7,NULL),
  ('Barbell Row',1,8,195),('Barbell Row',2,8,195),('Barbell Row',3,8,205),
  ('Seated Cable Row',1,12,160),('Seated Cable Row',2,12,160),('Seated Cable Row',3,10,170),
  ('Barbell Curl',1,10,95),('Barbell Curl',2,10,95),('Barbell Curl',3,8,105),
  ('Face Pull',1,15,55),('Face Pull',2,15,55),('Face Pull',3,12,60)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- May 30 — Legs Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-05-30','Legs Day',80,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Back Squat',1,8,235),('Back Squat',2,8,235),('Back Squat',3,6,255),('Back Squat',4,5,255),
  ('Romanian Deadlift',1,10,195),('Romanian Deadlift',2,10,195),('Romanian Deadlift',3,8,215),
  ('Leg Press',1,12,380),('Leg Press',2,12,380),('Leg Press',3,10,420),
  ('Leg Curl',1,12,105),('Leg Curl',2,12,105),('Leg Curl',3,10,115),
  ('Calf Raise',1,15,190),('Calf Raise',2,15,190),('Calf Raise',3,15,210)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- Jun 2 — Push Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-06-02','Push Day',70,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Barbell Bench Press',1,8,195),('Barbell Bench Press',2,8,195),('Barbell Bench Press',3,6,205),('Barbell Bench Press',4,5,205),
  ('Incline Dumbbell Press',1,10,75),('Incline Dumbbell Press',2,10,75),('Incline Dumbbell Press',3,8,80),
  ('Overhead Press',1,10,125),('Overhead Press',2,9,125),('Overhead Press',3,8,130),
  ('Skull Crushers',1,12,85),('Skull Crushers',2,12,85),('Skull Crushers',3,10,95),
  ('Cable Fly',1,15,45),('Cable Fly',2,15,45),('Cable Fly',3,12,50)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- Jun 4 — Pull Day
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-06-04','Pull Day',74,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Pull-up',1,10,NULL),('Pull-up',2,9,NULL),('Pull-up',3,8,NULL),
  ('T-Bar Row',1,8,135),('T-Bar Row',2,8,135),('T-Bar Row',3,8,145),
  ('Lat Pulldown',1,12,165),('Lat Pulldown',2,12,165),('Lat Pulldown',3,10,175),
  ('Hammer Curl',1,12,45),('Hammer Curl',2,12,45),('Hammer Curl',3,10,50),
  ('Straight-Arm Pulldown',1,15,55),('Straight-Arm Pulldown',2,15,55),('Straight-Arm Pulldown',3,12,60)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;

-- Jun 6 — Legs Day (most recent)
WITH wl AS (
  INSERT INTO workout_logs (client_id,date,program_day_name,duration_minutes,status)
  VALUES (1,'2026-06-06','Legs Day',82,'completed') RETURNING id
)
INSERT INTO set_logs (workout_log_id,exercise_id,exercise_name,set_number,reps,weight,weight_unit)
SELECT wl.id, e.id, e.name, s.sn, s.reps, s.wt, 'lbs'
FROM wl
CROSS JOIN (VALUES
  ('Back Squat',1,8,245),('Back Squat',2,8,245),('Back Squat',3,6,265),('Back Squat',4,5,265),
  ('Deadlift',1,6,295),('Deadlift',2,6,295),('Deadlift',3,5,315),('Deadlift',4,3,335),
  ('Leg Press',1,12,400),('Leg Press',2,12,400),('Leg Press',3,10,440),
  ('Bulgarian Split Squat',1,10,60),('Bulgarian Split Squat',2,10,60),('Bulgarian Split Squat',3,8,70),
  ('Calf Raise',1,15,200),('Calf Raise',2,15,200),('Calf Raise',3,15,220)
) AS s(exname,sn,reps,wt)
JOIN exercises e ON e.name = s.exname;
