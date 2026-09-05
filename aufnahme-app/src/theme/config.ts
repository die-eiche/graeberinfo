import { Platform } from "react-native";

export const colors = {
  background: "#000000",
  clock: "#F5F5F5",
  subtle: "rgba(255,255,255,0.45)",
  danger: "#FF453A",
  recording: "#FF453A",
  paused: "#FFD60A",
  idle: "rgba(255,255,255,0.55)",
};

export const isIos = Platform.OS === "ios";
