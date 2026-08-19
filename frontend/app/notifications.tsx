import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

const ICONS: Record<string, any> = {
  deposit: "arrow-down-circle",
  deposit_mock: "sparkles",
  share_purchase: "business",
  share_sale_received: "cash",
  interest: "trending-up",
  withdrawal_requested: "arrow-up-circle",
  withdrawal_refunded: "return-down-back",
  marketplace_buy: "cart",
  marketplace_sell: "cart-outline",
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<any[]>("/notifications");
      setItems(d);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="notif-back-btn">
            <Ionicons name="chevron-back" color={colors.onSurface} size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing["3xl"], gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {loading && <ActivityIndicator color={colors.brand} />}
        {!loading && items.length === 0 && (
          <Card><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>No notifications yet.</Text></Card>
        )}
        {items.map((n) => (
          <View key={n.id} style={styles.row} testID={`notif-${n.id}`}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICONS[n.type] || "notifications"} color={colors.brand} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.msg}>{n.message}</Text>
              <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, paddingHorizontal: spacing.xl },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { color: colors.onSurface, fontSize: 20, fontFamily: fonts.display, flex: 1, textAlign: "center" },
  row: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md, alignItems: "center" },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  msg: { color: colors.onSurface, fontSize: 14, textTransform: "capitalize" },
  time: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
});
