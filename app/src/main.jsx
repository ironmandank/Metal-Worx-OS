import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

import "./index.css";
import App from "./App.jsx";

const theme = {
  primaryColor: "red",
  colors: {
    red: [
      "#ffe5e5",
      "#ffb8b8",
      "#ff8a8a",
      "#ff5c5c",
      "#ff3030",
      "#d00000",
      "#a80000",
      "#7a0000",
      "#4d0000",
      "#260000",
    ],
  },
  fontFamily: "Inter, Arial, sans-serif",
  defaultRadius: "md",
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </StrictMode>
);
