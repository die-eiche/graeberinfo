import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { GlassButton } from "./src/components/GlassButton";
import { NoteTable } from "./src/components/NoteTable";
import { SettingsModal } from "./src/components/SettingsModal";
import { useAufnahmeSession } from "./src/hooks/useAufnahmeSession";
import { buildNoteTableRows } from "./src/services/discoveries";
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
    noteMarkdown,
    focusFields,
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
      ? "Aufnahme läuft · live"
      : status === "paused"
        ? "Pausiert"
        : status === "stopped"
          ? "Beendet"
          : null;

  const showTitle = Boolean(title && title !== "Aufnahme");
  const rows = useMemo(() => buildNoteTableRows(noteMarkdown), [noteMarkdown]);
  const showTable = status !== "idle" || Boolean(noteMarkdown.trim());

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        {(status === "recording" || status === "paused") && <KeepAwakeOn />}
        <View style={styles.screen}>
          <View style={styles.header}>
            {statusLabel ? <Text style={styles.status}>{statusLabel}</Text> : null}
            {showTitle ? (
              <Text style={styles.noteTitle} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {!keyConfigured ? (
              <Text style={styles.keyHint}>Schlüssel fehlt – bitte Einstellungen öffnen</Text>
            ) : null}
          </View>

          <View style={styles.table}>
            {showTable ? (
              <NoteTable rows={rows} focusFields={focusFields} />
            ) : (
              <View style={styles.placeholder} />
            )}
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
            <Pressable
              onPress={() => setSettingsOpen(true)}
              accessibilityRole="button"
              style={styles.settingsLink}
            >
              <Text style={styles.settingsText}>Einstellungen</Text>
            </Pressable>
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
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
    paddingBottom: 8,
  },
  status: {
    color: colors.subtle,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  noteTitle: {
    color: "rgba(180,180,180,0.95)",
    fontSize: 15,
  },
  keyHint: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  table: {
    flex: 1,
    minHeight: 160,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  controls: {
    alignItems: "center",
    paddingBottom: 8,
    paddingTop: 8,
  },
  gap: {
    height: 12,
  },
  settingsLink: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  settingsText: {
    color: "rgba(130,130,130,0.95)",
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginBottom: 14,
    fontSize: 12,
  },
  errorSpacer: {
    height: 28,
  },
});
