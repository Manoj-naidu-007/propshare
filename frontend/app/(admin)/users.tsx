import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Card } from "@/src/ui";
import { api } from "@/src/api";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await api<any[]>("/admin/users")); }
    catch (e) { console.warn(e); } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (u: any) => {
    const nextStatus = u.status === "active" ? "suspended" : "active";
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { status: nextStatus } });
      load();
    } catch (e) { console.warn(e); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={{ padding: spacing.xl, paddingBottom: 0 }}>
          <Text style={styles.title}>Users</Text>
          <Text style={styles.sub}>{users.length} accounts</Text>
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {loading && <ActivityIndicator color={colors.brand} />}
        {users.map((u) => (
          <View key={u.id} style={styles.row} testID={`admin-user-${u.id}`}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{(u.name || u.email)[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.name}</Text>
              <Text style={styles.email}>{u.email}</Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                <Pill label={u.role} tone="brand" />
                <Pill label={u.status || "active"} tone={u.status === "suspended" ? "error" : "success"} />
              </View>
            </View>
            {u.role !== "Admin" && (
              <TouchableOpacity onPress={() => toggle(u)} style={styles.toggle} testID={`admin-user-toggle-${u.id}`}>
                <Ionicons name={u.status === "suspended" ? "checkmark-circle" : "close-circle"} color={u.status === "suspended" ? colors.success : colors.error} size={22} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Pill({ label, tone }: { label: string; tone: "brand" | "success" | "error" }) {
  const map: any = { brand: colors.brand, success: colors.success, error: colors.error };
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: map[tone] }}>
      <Text style={{ color: map[tone], fontSize: 10, letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  sub: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brand, fontSize: 16, fontFamily: fonts.display },
  name: { color: colors.onSurface, fontSize: 15 },
  email: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  toggle: { padding: 8 },
});
