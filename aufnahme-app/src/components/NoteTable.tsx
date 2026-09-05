import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NoteTableRow } from "../services/discoveries";

type Props = {
  rows: NoteTableRow[];
  focusFields: string[];
  title?: string;
};

export function NoteTable({ rows, focusFields, title }: Props) {
  const listRef = useRef<FlatList<NoteTableRow>>(null);
  const focusKey = focusFields.join("|");

  useEffect(() => {
    const targets = [
      ...focusFields,
      ...rows.filter((r) => r.uncertain).map((r) => r.field),
    ];
    if (!targets.length) return;
    const index = rows.findIndex((row) => targets.includes(row.field));
    if (index < 0) return;
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.35,
        });
      } catch {
        // ignore scroll race while list mounts
      }
    }, 80);
    return () => clearTimeout(t);
  }, [focusKey, focusFields, rows]);

  return (
    <View style={styles.wrap}>
      {title && title !== "Aufnahme" ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <View style={styles.head}>
        <View style={styles.dotCol} />
        <Text style={[styles.headCell, styles.fieldCol]}>Feld</Text>
        <Text style={[styles.headCell, styles.valueCol]}>Wert</Text>
      </View>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.field}
        showsVerticalScrollIndicator
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index - 40),
              animated: true,
            });
          }, 100);
        }}
        renderItem={({ item }) => {
          const highlighted = focusFields.includes(item.field) || item.uncertain;
          const filled = Boolean(item.value);
          return (
            <View style={[styles.row, highlighted ? styles.rowFocus : null]}>
              <View style={styles.dotCol}>
                {item.uncertain ? <View style={styles.dot} /> : null}
              </View>
              <Text
                style={[
                  styles.field,
                  styles.fieldCol,
                  filled ? styles.fieldLabelFilled : styles.fieldLabelEmpty,
                ]}
                numberOfLines={2}
              >
                {item.field}
              </Text>
              <Text
                style={[
                  styles.value,
                  styles.valueCol,
                  filled ? styles.valueFilled : styles.valueEmpty,
                  highlighted ? styles.valueFocus : null,
                ]}
              >
                {item.value || " "}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: "100%",
  },
  title: {
    color: "rgba(180,180,180,0.9)",
    fontSize: 15,
    marginBottom: 8,
    fontWeight: "500",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.18)",
    paddingBottom: 6,
    marginBottom: 2,
  },
  headCell: {
    color: "rgba(140,140,140,0.95)",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowFocus: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  dotCol: {
    width: 14,
    paddingTop: 4,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FF453A",
  },
  fieldCol: {
    width: "46%",
    paddingRight: 8,
  },
  valueCol: {
    width: "50%",
  },
  field: {
    fontSize: 12,
    lineHeight: 16,
  },
  value: {
    fontSize: 13,
    lineHeight: 17,
  },
  /** Leere Feldbezeichner: etwas heller */
  fieldLabelEmpty: {
    color: "rgba(155,155,155,0.95)",
  },
  /** Ausgefüllte Feldbezeichner: weiter abgedunkelt */
  fieldLabelFilled: {
    color: "rgba(105,105,105,0.95)",
  },
  valueEmpty: {
    color: "rgba(90,90,90,0.9)",
  },
  /** Ausgefüllte Werte: leicht weiter abgedunkelt */
  valueFilled: {
    color: "rgba(135,135,135,0.98)",
  },
  valueFocus: {
    color: "rgba(190,190,190,1)",
  },
});
