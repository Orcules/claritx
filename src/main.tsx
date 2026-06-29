import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";
import { awsConfig } from "./lib/aws-config.ts";
import { Authenticator } from "@aws-amplify/ui-react";

Amplify.configure(awsConfig);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator.Provider>
      <App />
    </Authenticator.Provider>
  </React.StrictMode>
);
