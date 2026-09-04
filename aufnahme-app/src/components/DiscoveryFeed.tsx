import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { Discovery } from "../services/discoveries";
import { colors } from "../theme/config";

type Props = {
  items: Discovery[];
};

export function DiscoveryFeed({ items }: Props) {
  const listRef = useRef<FlatList<Discovery>>(null);

  useEffect(() => {
    if (items.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.empty}>Noch keine Angaben erkannt</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.field}>{item.field}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    width: "100%",
  },
  content: {
    paddingVertical: 8,
    gap: 14,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    color: colors.subtle,
    fontSize: 14,
  },
  row: {
    width: "100%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingBottom: 10,
  },
  field: {
    color: colors.subtle,
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  value: {
    color: colors.clock,
    fontSize: 17,
    fontWeight: "500",
  },
});
