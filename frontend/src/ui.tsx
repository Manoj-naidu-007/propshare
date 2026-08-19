import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle, TouchableOpacity, ActivityIndicator } from "react-native";
import { colors, fonts, radius, spacing } from "./theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.glass, style]}>{children}</View>;
}

export function KPI({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View testID={testID} style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

export function GoldButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: ViewStyle;
  testID?: string;
}) {
  const disabledAll = disabled || loading;
  const styleMap: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.brand },
    secondary: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
    ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.brand },
    danger: { backgroundColor: colors.error },
  };
  const textMap: Record<string, TextStyle> = {
    primary: { color: colors.onBrandPrimary },
    secondary: { color: colors.onSurface },
    ghost: { color: colors.brand },
    danger: { color: "#FFFFFF" },
  };
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.button, styleMap[variant], disabledAll && { opacity: 0.5 }, style]}
      onPress={onPress}
      disabled={disabledAll}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onBrandPrimary : colors.brand} />
      ) : (
        <Text style={[styles.buttonText, textMap[variant]]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, active && { borderColor: colors.brand, backgroundColor: colors.brandTertiary }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active && { color: colors.brand }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />;
}

export const fmtInr = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  glass: {
    backgroundColor: "rgba(28,28,33,0.72)",
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  kpi: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontFamily: fonts.text, letterSpacing: 0.5, textTransform: "uppercase" },
  kpiValue: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, marginTop: 4 },
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonText: { fontSize: 16, fontWeight: "600", fontFamily: fonts.text },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontFamily: fonts.text },
});
