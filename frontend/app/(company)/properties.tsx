import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ImageBackground, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { fmtInr } from "@/src/ui";
import { api } from "@/src/api";

const FALLBACK = "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85";

export default function CompanyProperties() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<any[]>("/properties");
      setItems(d);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Your properties</Text>
        </View>
      </SafeAreaView>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} /> : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => <Row item={item} onPress={() => router.push(`/property/${item.id}`)} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Text style={{ color: colors.onSurfaceTertiary }}>No properties listed yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function Row({ item, onPress }: any) {
  const img = item.images?.[0] || FALLBACK;
  const src = img.startsWith("data:") || img.startsWith("http") ? { uri: img } : { uri: `data:image/jpeg;base64,${img}` };
  const statusColor = item.status === "approved" ? colors.success : item.status === "pending" ? colors.warning : colors.error;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.row} testID={`company-prop-${item.id}`}>
      <ImageBackground source={src} style={styles.img} imageStyle={{ borderRadius: radius.lg }}>
        <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.85)"]} style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }} />
        <View style={[styles.pill, { borderColor: statusColor, backgroundColor: `${statusColor}33` }]}>
          <Text style={[styles.pillText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
        </View>
        <View style={{ padding: spacing.md }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.loc}>{item.location}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
            <Text style={styles.stat}>{item.shares_sold}/{item.total_shares} sold</Text>
            <Text style={styles.stat}>{fmtInr(item.share_price * item.shares_sold)} raised</Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: 0 },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  row: { borderRadius: radius.lg, overflow: "hidden" },
  img: { height: 200, justifyContent: "flex-end" },
  pill: { position: "absolute", top: spacing.md, right: spacing.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  name: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display },
  loc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  stat: { color: colors.onSurface, fontSize: 12 },
});
