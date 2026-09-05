import { BlurView } from "expo-blur";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/config";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "active";
};

export function GlassButton({ label, onPress, disabled, tone = "neutral" }: Props) {
  const borderColor =
    tone === "danger"
      ? "rgba(255,69,58,0.55)"
      : tone === "active"
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.28)";

  const textColor =
    tone === "danger" ? colors.danger : tone === "active" ? "#FFFFFF" : "rgba(255,255,255,0.92)";

  if (Platform.OS === "ios") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          { opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        ]}
      >
        <BlurView intensity={42} tint="dark" style={[styles.glass, { borderColor }]}>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </BlurView>
      </Pressable>
    );
  }

  // Android: dunkle, matte Alternative ohne iOS-Glas
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.androidBtn, { borderColor }]}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    maxWidth: 280,
  },
  glass: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  androidBtn: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#121212",
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
