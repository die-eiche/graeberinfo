import { useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NoteTableRow } from "../services/discoveries";

type Props = {
  rows: NoteTableRow[];
  focusFields: string[];
  lockedFields?: string[];
  title?: string;
  onEditRow?: (field: string, value: string) => void;
};

export function NoteTable({
  rows,
  focusFields,
  lockedFields = [],
  title,
  onEditRow,
}: Props) {
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
        <Text style={[styles.headCell, styles.fieldCol]}>Feld</Text>
        <View style={styles.valueHead}>
          <View style={styles.dotCol} />
          <Text style={[styles.headCell, styles.valueHeadText]}>Wert</Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={rows}
        keyExtractor={(item) => item.field}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
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
          const locked = lockedFields.includes(item.field);
          const filled = Boolean(item.value);
          const row = (
            <View
              style={[
                styles.row,
                highlighted ? styles.rowFocus : null,
                locked ? styles.rowLocked : null,
              ]}
            >
              <Text
                style={[
                  styles.field,
                  styles.fieldCol,
                  filled ? styles.fieldLabelFilled : styles.fieldLabelEmpty,
                ]}
                numberOfLines={2}
              >
                {item.field}
                {locked ? " · fest" : ""}
              </Text>
              <View style={styles.valueCell}>
                <View style={styles.dotCol}>
                  {item.uncertain ? <View style={styles.dot} /> : null}
                </View>
                <Text
                  style={[
                    styles.value,
                    styles.valueText,
                    filled ? styles.valueFilled : styles.valueEmpty,
                    highlighted ? styles.valueFocus : null,
                    locked ? styles.valueLocked : null,
                  ]}
                >
                  {item.value || " "}
                </Text>
              </View>
            </View>
          );
          if (!onEditRow) return row;
          return (
            <Pressable
              onPress={() => onEditRow(item.field, item.value)}
              accessibilityRole="button"
              accessibilityLabel={`${item.field} bearbeiten`}
            >
              {row}
            </Pressable>
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
  rowLocked: {
    backgroundColor: "rgba(90,140,255,0.08)",
  },
  fieldCol: {
    width: "44%",
    paddingRight: 8,
  },
  valueHead: {
    width: "56%",
    flexDirection: "row",
    alignItems: "center",
  },
  valueHeadText: {
    flex: 1,
  },
  valueCell: {
    width: "56%",
    flexDirection: "row",
    alignItems: "flex-start",
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
  valueText: {
    flex: 1,
  },
  field: {
    fontSize: 12,
    lineHeight: 16,
  },
  value: {
    fontSize: 13,
    lineHeight: 17,
  },
  fieldLabelEmpty: {
    color: "rgba(155,155,155,0.95)",
  },
  fieldLabelFilled: {
    color: "rgba(105,105,105,0.95)",
  },
  valueEmpty: {
    color: "rgba(90,90,90,0.9)",
  },
  valueFilled: {
    color: "rgba(135,135,135,0.98)",
  },
  valueFocus: {
    color: "rgba(190,190,190,1)",
  },
  valueLocked: {
    color: "rgba(170,190,255,0.98)",
  },
});
