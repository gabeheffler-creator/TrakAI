import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Loader2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const surveySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.string().min(1, "Please select your role"),
  clientCount: z.string().min(1, "Please select your client count"),
  currentTools: z.string().optional(),
  painPoints: z.string().optional(),
  mostValuableFeature: z.string().min(1, "Please select a feature"),
  betaInterest: z.string().min(1, "Please select your interest level")
});

type SurveyValues = z.infer<typeof surveySchema>;

const ROLES = [
  "Personal Trainer",
  "Strength & Conditioning Coach",
  "Online Fitness Coach",
  "Nutrition Coach",
  "Fitness Consultant",
  "Gym Owner",
  "Other"
];

const CLIENT_COUNTS = ["1–5", "6–15", "16–30", "30+"];

const FEATURES = [
  "AI-powered program building",
  "Automated client check-ins",
  "Progress tracking & analytics",
  "Client communication tools",
  "Nutrition & habit tracking",
  "Video exercise library",
  "I want it all"
];

const INTEREST_LEVELS = [
  "Very interested — sign me up!",
  "Interested — tell me more",
  "Curious but not sure yet",
  "Not right now"
];

export default function SurveyPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<SurveyValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      name: "",
      email: "",
      role: "",
      clientCount: "",
      currentTools: "",
      painPoints: "",
      mostValuableFeature: "",
      betaInterest: ""
    },
    mode: "onTouched"
  });

  const { formState: { errors, isValid } } = form;

  const validateStep = async () => {
    let fieldsToValidate: (keyof SurveyValues)[] = [];
    
    if (step === 1) fieldsToValidate = ["name", "email"];
    if (step === 2) fieldsToValidate = ["role", "clientCount"];
    // Step 3 is optional
    if (step === 4) fieldsToValidate = ["mostValuableFeature", "betaInterest"];

    const isStepValid = await form.trigger(fieldsToValidate);
    if (isStepValid) {
      if (step < 4) {
        setStep(step + 1);
      } else {
        handleSubmit(form.getValues());
      }
    }
  };

  const handleSubmit = async (data: SurveyValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const BASE_URL = import.meta.env.BASE_URL;
      const res = await fetch("/api/survey-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit response");
      }
      
      setIsSuccess(true);
    } catch (error) {
      setErrorMsg("Something went wrong submitting your response. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary selection:text-primary-foreground">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
          className="max-w-md w-full text-center space-y-6"
        >
          <div className="w-24 h-24 bg-primary text-primary-foreground flex items-center justify-center mx-auto rounded-none rotate-3 shadow-md">
            <Check className="w-12 h-12 -rotate-3" strokeWidth={3} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">You're In.</h1>
          <p className="text-muted-foreground text-lg font-mono">
            Response recorded. We'll be in touch with beta access details soon. Keep training.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Header & Progress */}
      <header className="p-6 md:p-8 flex items-center justify-between border-b-4 border-foreground/10 sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 44 44" fill="none" className="flex-shrink-0">
            <rect width="44" height="44" rx="12" fill="#7c3aed" />
            <polyline
              points="6,22 13,22 17,12 21,32 25,18 29,22 38,22"
              stroke="white"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div className="flex items-baseline gap-0">
            <span className="text-lg font-extrabold tracking-tight text-foreground leading-none">Trak</span>
            <span className="text-lg font-light tracking-tight text-violet-500 leading-none">AI</span>
          </div>
        </div>
        <div className="font-mono text-sm font-bold flex gap-1 items-center">
          <span className="text-muted-foreground">STEP</span>
          <span className="text-primary bg-foreground px-2 py-0.5 rounded-none">{step}</span>
          <span className="text-muted-foreground">/ 4</span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center">
        {errorMsg && (
          <div className="bg-destructive text-destructive-foreground p-4 mb-8 font-mono text-sm flex items-start gap-3 shadow-sm border-2 border-foreground">
            <Info className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-10"
            >
              
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-8" data-testid="step-1">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-2">Let's Connect.</h2>
                    <p className="text-muted-foreground font-mono">Where should we send your beta invite?</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                      <Input 
                        id="name" 
                        {...form.register("name")}
                        className="h-14 text-lg bg-muted border-none rounded-none focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:bg-secondary font-medium transition-colors"
                        placeholder="John Doe"
                      />
                      {errors.name && <p className="text-destructive font-mono text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email"
                        {...form.register("email")}
                        className="h-14 text-lg bg-muted border-none rounded-none focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:bg-secondary font-medium transition-colors"
                        placeholder="john@example.com"
                      />
                      {errors.email && <p className="text-destructive font-mono text-xs mt-1">{errors.email.message}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-10" data-testid="step-2">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-2">Your Practice.</h2>
                    <p className="text-muted-foreground font-mono">Tell us about how you operate.</p>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">What best describes you?</Label>
                    <RadioGroup 
                      onValueChange={(val) => form.setValue("role", val, { shouldValidate: true })}
                      defaultValue={form.getValues("role")}
                      className="grid gap-3"
                    >
                      {ROLES.map((role) => (
                        <div key={role} className="flex items-center space-x-2">
                          <RadioGroupItem value={role} id={`role-${role}`} className="peer sr-only" />
                          <Label
                            htmlFor={`role-${role}`}
                            className="flex flex-1 items-center justify-between border-2 border-muted bg-transparent px-4 py-4 hover:bg-muted peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background cursor-pointer font-semibold transition-all shadow-sm"
                          >
                            {role}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {errors.role && <p className="text-destructive font-mono text-xs">{errors.role.message}</p>}
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">Active Clients</Label>
                    <RadioGroup 
                      onValueChange={(val) => form.setValue("clientCount", val, { shouldValidate: true })}
                      defaultValue={form.getValues("clientCount")}
                      className="grid grid-cols-2 gap-3"
                    >
                      {CLIENT_COUNTS.map((count) => (
                        <div key={count} className="flex items-center space-x-2">
                          <RadioGroupItem value={count} id={`count-${count}`} className="peer sr-only" />
                          <Label
                            htmlFor={`count-${count}`}
                            className="flex flex-1 items-center justify-center border-2 border-muted bg-transparent px-4 py-4 hover:bg-muted peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background cursor-pointer font-bold text-lg font-mono transition-all shadow-sm"
                          >
                            {count}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {errors.clientCount && <p className="text-destructive font-mono text-xs">{errors.clientCount.message}</p>}
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-8" data-testid="step-3">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-2">Current Setup.</h2>
                    <p className="text-muted-foreground font-mono">What's holding you back right now?</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="tools" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What tools do you currently use?</Label>
                      <Textarea 
                        id="tools" 
                        {...form.register("currentTools")}
                        className="min-h-[120px] text-base bg-muted border-none rounded-none focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:bg-secondary font-medium resize-none transition-colors"
                        placeholder="Spreadsheets, TrueCoach, Trainerize, WhatsApp..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pain" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">What's your biggest frustration?</Label>
                      <Textarea 
                        id="pain" 
                        {...form.register("painPoints")}
                        className="min-h-[120px] text-base bg-muted border-none rounded-none focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:bg-secondary font-medium resize-none transition-colors"
                        placeholder="Too much time spent adjusting programs manually..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div className="space-y-10" data-testid="step-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight mb-2">The Future.</h2>
                    <p className="text-muted-foreground font-mono">Help us build what matters.</p>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">Most valuable feature?</Label>
                    <RadioGroup 
                      onValueChange={(val) => form.setValue("mostValuableFeature", val, { shouldValidate: true })}
                      defaultValue={form.getValues("mostValuableFeature")}
                      className="grid gap-2"
                    >
                      {FEATURES.map((feature) => (
                        <div key={feature} className="flex items-center space-x-2">
                          <RadioGroupItem value={feature} id={`feature-${feature}`} className="peer sr-only" />
                          <Label
                            htmlFor={`feature-${feature}`}
                            className="flex flex-1 items-center justify-between border-2 border-muted bg-transparent px-4 py-3 hover:bg-muted peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background cursor-pointer font-medium transition-all shadow-sm"
                          >
                            {feature}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {errors.mostValuableFeature && <p className="text-destructive font-mono text-xs">{errors.mostValuableFeature.message}</p>}
                  </div>

                  <div className="space-y-4">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground block mb-4">Beta Interest</Label>
                    <RadioGroup 
                      onValueChange={(val) => form.setValue("betaInterest", val, { shouldValidate: true })}
                      defaultValue={form.getValues("betaInterest")}
                      className="grid gap-2"
                    >
                      {INTEREST_LEVELS.map((level) => (
                        <div key={level} className="flex items-center space-x-2">
                          <RadioGroupItem value={level} id={`level-${level}`} className="peer sr-only" />
                          <Label
                            htmlFor={`level-${level}`}
                            className="flex flex-1 items-center justify-between border-2 border-muted bg-transparent px-4 py-3 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer font-bold transition-all shadow-sm"
                          >
                            {level}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    {errors.betaInterest && <p className="text-destructive font-mono text-xs">{errors.betaInterest.message}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex gap-4 pt-8 border-t-4 border-muted">
            {step > 1 && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setStep(step - 1)}
                disabled={isSubmitting}
                className="rounded-none border-2 h-14 font-mono text-base font-bold shadow-xs hover:-translate-y-1 hover:shadow-sm transition-all"
                data-testid="button-back"
              >
                Back
              </Button>
            )}
            
            <Button 
              size="lg" 
              onClick={validateStep}
              disabled={isSubmitting}
              className="rounded-none border-2 border-foreground h-14 font-sans text-lg font-black uppercase tracking-wider shadow-xs hover:-translate-y-1 hover:shadow-sm transition-all flex-1 bg-foreground text-background hover:bg-primary hover:text-primary-foreground hover:border-primary"
              data-testid={step === 4 ? "button-submit" : "button-next"}
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : step === 4 ? (
                "Submit Protocol"
              ) : (
                <span className="flex items-center gap-2">Next Phase <ArrowRight className="w-5 h-5" /></span>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
