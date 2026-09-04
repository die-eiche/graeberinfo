import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApiKey, setApiKey } from "../services/apiKey";
import { colors } from "../theme/config";
import { GlassButton } from "./GlassButton";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SettingsModal({ visible, onClose }: Props) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSaved(false);
    setError(null);
    void getApiKey().then(setValue);
  }, [visible]);

  const save = async () => {
    try {
      await setApiKey(value);
      setSaved(true);
      setError(null);
    } catch {
      setError("Speichern fehlgeschlagen.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Einstellungen</Text>
          <Text style={styles.help}>
            Hier den gemeinsamen Mistral-Schlüssel einmal eintragen. Er bleibt auf
            diesem Handy gespeichert.
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Mistral API-Schlüssel"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
          {saved ? <Text style={styles.ok}>Gespeichert.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <GlassButton label="Speichern" onPress={() => void save()} tone="active" />
          <View style={{ height: 12 }} />
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },
  title: {
    color: colors.clock,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  help: {
    color: colors.subtle,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    marginBottom: 14,
  },
  ok: {
    color: "#30D158",
    marginBottom: 10,
  },
  error: {
    color: colors.danger,
    marginBottom: 10,
  },
  close: {
    color: colors.subtle,
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 16,
  },
});
