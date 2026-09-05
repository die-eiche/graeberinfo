import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../theme/config";
import { GlassButton } from "./GlassButton";

type Props = {
  visible: boolean;
  field: string;
  value: string;
  onSave: (nextValue: string) => void;
  onClose: () => void;
};

/**
 * Großes Editierfenster für einen Tabelleneintrag.
 * Nach Speichern gilt der Wert als manuell gesetzt (Pipeline überschreibt ihn nicht).
 */
export function FieldEditModal({ visible, field, value, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value, field]);

  const save = () => {
    onSave(draft.trim());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.kicker}>Eintrag bearbeiten</Text>
          <Text style={styles.field}>{field}</Text>
          <Text style={styles.hint}>
            Manuell gesetzte Werte bleiben erhalten und werden von der Aufnahme nicht
            mehr überschrieben.
          </Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Wert eingeben"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoCapitalize="sentences"
            autoCorrect
            multiline
            style={styles.input}
            textAlignVertical="top"
          />
          <GlassButton label="Übernehmen" onPress={save} tone="active" />
          <View style={{ height: 12 }} />
          <GlassButton label="Abbrechen" onPress={onClose} tone="neutral" />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  backdropPress: {
    flex: 1,
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: "58%",
  },
  kicker: {
    color: "rgba(140,140,140,0.95)",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  field: {
    color: colors.clock,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },
  hint: {
    color: "rgba(160,160,160,0.95)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  input: {
    minHeight: 140,
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F2F2F2",
    fontSize: 18,
    lineHeight: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 18,
  },
});
