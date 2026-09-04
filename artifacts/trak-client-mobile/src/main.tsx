import { createRoot } from "react-dom/client";
import App from "../../trak-client/src/App";
import "../../trak-client/src/index.css";
import { initializeNativeRuntime } from "./native-runtime";

void initializeNativeRuntime().then(() => createRoot(document.getElementById("root")!).render(<App />));
