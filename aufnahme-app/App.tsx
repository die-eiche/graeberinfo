import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DiscoveryFeed } from "./src/components/DiscoveryFeed";
import { GlassButton } from "./src/components/GlassButton";
import { SettingsModal } from "./src/components/SettingsModal";
import { SystemClock } from "./src/components/SystemClock";
import { useAufnahmeSession } from "./src/hooks/useAufnahmeSession";
import { colors } from "./src/theme/config";

function KeepAwakeOn() {
  useKeepAwake();
  return null;
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    status,
    title,
    discoveries,
    error,
    busy,
    keyConfigured,
    refreshKeyState,
    toggleStartPause,
    stop,
  } = useAufnahmeSession();

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
          <View style={styles.topRow}>
            <View style={{ width: 72 }} />
            <SystemClock />
            <Pressable
              onPress={() => setSettingsOpen(true)}
              accessibilityRole="button"
              style={styles.settingsBtn}
            >
              <Text style={styles.settingsText}>Einst.</Text>
            </Pressable>
          </View>

          <View style={styles.header}>
            <Text style={styles.status}>{statusLabel}</Text>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {title}
            </Text>
            {!keyConfigured ? (
              <Text style={styles.keyHint}>Schlüssel fehlt – bitte Einstellungen öffnen</Text>
            ) : null}
          </View>

          <View style={styles.feed}>
            <DiscoveryFeed items={discoveries} />
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

        <SettingsModal
          visible={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            void refreshKeyState();
          }}
        />
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
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingsBtn: {
    width: 72,
    alignItems: "flex-end",
    paddingVertical: 8,
  },
  settingsText: {
    color: colors.subtle,
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
    paddingBottom: 12,
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
  keyHint: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  feed: {
    flex: 1,
    minHeight: 120,
  },
  controls: {
    alignItems: "center",
    paddingBottom: 12,
    paddingTop: 8,
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
