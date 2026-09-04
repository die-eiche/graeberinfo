import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/config";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function SystemClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const label = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={`Uhrzeit ${label}`}>
      <Text style={styles.clock}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
  },
  clock: {
    color: colors.clock,
    fontSize: 48,
    fontVariant: ["tabular-nums"],
    fontWeight: "300",
    letterSpacing: 2,
  },
});
