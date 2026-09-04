import { Platform } from "react-native";

/** API-Basis-URL – per Expo-Extra oder Fallback für lokale Entwicklung */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787");

export const colors = {
  background: "#000000",
  clock: "#F5F5F5",
  subtle: "rgba(255,255,255,0.45)",
  danger: "#FF453A",
  recording: "#FF453A",
  paused: "#FFD60A",
  idle: "rgba(255,255,255,0.55)",
};
