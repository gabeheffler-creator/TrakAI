import { createRoot } from "react-dom/client";
import App from "../../trak-coach/src/App";
import "../../trak-coach/src/index.css";
import { initializeNativeRuntime } from "./native-runtime";

void initializeNativeRuntime().then(() => createRoot(document.getElementById("root")!).render(<App />));
