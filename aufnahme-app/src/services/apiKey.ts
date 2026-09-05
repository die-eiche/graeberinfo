import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "mistral_api_key";

/** Auf Web kein SecureStore – Fallback AsyncStorage nur für lokale Tests. */
export async function getApiKey(): Promise<string> {
  if (Platform.OS === "web") {
    return (await AsyncStorage.getItem(KEY)) || "";
  }
  return (await SecureStore.getItemAsync(KEY)) || "";
}

export async function setApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (Platform.OS === "web") {
    if (!trimmed) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, trimmed);
    return;
  }
  if (!trimmed) {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  await SecureStore.setItemAsync(KEY, trimmed);
}

export async function hasApiKey(): Promise<boolean> {
  return Boolean(await getApiKey());
}
