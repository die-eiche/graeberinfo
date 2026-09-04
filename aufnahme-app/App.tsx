import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import { GlassButton } from "./src/components/GlassButton";
import { SystemClock } from "./src/components/SystemClock";
import { useAufnahmeSession } from "./src/hooks/useAufnahmeSession";
import { colors } from "./src/theme/config";

function KeepAwakeOn() {
  useKeepAwake();
  return null;
}

export default function App() {
  const { status, title, error, busy, toggleStartPause, stop } = useAufnahmeSession();

  const primaryLabel =
    status === "recording" ? "Pause" : status === "paused" ? "Weiter" : "Start";

  const statusLabel =
    status === "recording"
      ? "Aufnahme läuft"
      : status === "paused"
        ? "Pausiert"
        : status === "stopped"
          ? "Beendet"
          : "Bereit";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {(status === "recording" || status === "paused") && <KeepAwakeOn />}
        <View style={styles.screen}>
          <SystemClock />

          <View style={styles.centerBlock}>
            <Text style={styles.status}>{statusLabel}</Text>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={styles.controls}>
            <GlassButton
              label={primaryLabel}
              onPress={() => void toggleStartPause()}
              disabled={busy}
              tone={status === "recording" ? "active" : "neutral"}
            />
            <View style={styles.gap} />
            <GlassButton
              label="Stop"
              onPress={() => void stop()}
              disabled={busy || status === "idle" || status === "stopped"}
              tone="danger"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  centerBlock: {
    alignItems: "center",
    gap: 8,
  },
  status: {
    color: colors.subtle,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  noteTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },
  controls: {
    alignItems: "center",
    paddingBottom: 36,
  },
  gap: {
    height: 14,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginBottom: 18,
    fontSize: 13,
  },
  errorSpacer: {
    height: 34,
  },
});
