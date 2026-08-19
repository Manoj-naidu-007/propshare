import { useCallback, useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl, ImageBackground, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { Chip, fmtInr } from "@/src/ui";
import { api } from "@/src/api";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85";

const TYPES = ["All", "Residential", "Commercial", "Mixed-Use", "Retail", "Industrial"];

export default function Properties() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>("/properties");
      setItems(data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((p) => (p.property_type || "").toLowerCase().includes(filter.toLowerCase()));
  }, [items, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Text style={styles.title}>Explore</Text>
          <Text style={styles.subtitle}>Curated properties open to investment.</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {TYPES.map((t) => (
            <Chip key={t} label={t} active={filter === t} onPress={() => setFilter(t)} testID={`filter-chip-${t.toLowerCase()}`} />
          ))}
        </ScrollView>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing["3xl"], paddingTop: spacing.md, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => <PropertyRow property={item} onPress={() => router.push(`/property/${item.id}`)} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Text style={{ color: colors.onSurfaceTertiary }}>No properties in this category.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function PropertyRow({ property, onPress }: any) {
  const img = property.images?.[0] || FALLBACK_IMG;
  const src = img.startsWith("data:") || img.startsWith("http") ? { uri: img } : { uri: `data:image/jpeg;base64,${img}` };
  const avail = property.total_shares - property.shares_sold;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.row} testID={`property-row-${property.id}`}>
      <ImageBackground source={src} style={styles.img} imageStyle={{ borderRadius: radius.lg }}>
        <LinearGradient
          colors={["rgba(18,18,21,0.1)", "rgba(18,18,21,0.85)"]}
          style={{ ...StyleSheet.absoluteFillObject, borderRadius: radius.lg }}
        />
        <View style={styles.badge}><Text style={styles.badgeText}>{property.monthly_return_rate}% MO</Text></View>
        <View style={styles.imgInner}>
          <Text style={styles.type}>{property.property_type}</Text>
          <Text style={styles.name}>{property.name}</Text>
          <Text style={styles.loc}><Ionicons name="location" size={11} color={colors.onSurfaceTertiary} /> {property.location}</Text>
        </View>
      </ImageBackground>
      <View style={styles.footer}>
        <View style={styles.footCol}>
          <Text style={styles.footLabel}>SHARE</Text>
          <Text style={styles.footValue}>{fmtInr(property.share_price)}</Text>
        </View>
        <View style={styles.footCol}>
          <Text style={styles.footLabel}>VALUE</Text>
          <Text style={styles.footValue}>{fmtInr(property.total_value)}</Text>
        </View>
        <View style={styles.footCol}>
          <Text style={styles.footLabel}>AVAILABLE</Text>
          <Text style={styles.footValue}>{avail}/{property.total_shares}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: 4 },
  chipsRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  row: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  img: { height: 200, justifyContent: "flex-end" },
  badge: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },
  imgInner: { padding: spacing.md },
  type: { color: colors.brand, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" },
  name: { color: colors.onSurface, fontSize: 22, fontFamily: fonts.display, marginTop: 2 },
  loc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  footer: { flexDirection: "row", padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  footCol: { flex: 1 },
  footLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1 },
  footValue: { color: colors.onSurface, fontSize: 15, fontFamily: fonts.display, marginTop: 2 },
});
