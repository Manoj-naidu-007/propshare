import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, radius, spacing } from "@/src/theme";
import { GoldButton } from "@/src/ui";
import { api } from "@/src/api";

const IMG_LIB = [
  "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1643175517006-4a1bd8ad37cb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwzfHxwcmVtaXVtJTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwYnVpbGRpbmclMjBleHRlcmlvciUyMGRhcmt8ZW58MHx8fHwxNzg1NTAzMDgxfDA&ixlib=rb-4.1.0&q=85",
  "https://images.unsplash.com/photo-1724582586495-d050726cf354?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODl8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb20lMjBuaWdodHxlbnwwfHx8fDE3ODU1MDMwODB8MA&ixlib=rb-4.1.0&q=85",
];

const TYPES = ["Residential", "Commercial", "Mixed-Use", "Retail", "Industrial"];

export default function AddProperty() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [propType, setPropType] = useState("Residential");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [totalShares, setTotalShares] = useState("");
  const [sharePrice, setSharePrice] = useState("");
  const [returnRate, setReturnRate] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickImages = async () => {
    setErr(null);
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErr(perm.canAskAgain ? "Photo permission is required." : "Enable photo access in Settings.");
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
      allowsMultipleSelection: Platform.OS !== "android",
      selectionLimit: 5,
    });
    if (res.canceled) return;
    const newImgs = (res.assets || [])
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri))
      .filter(Boolean) as string[];
    setImages((prev) => [...prev, ...newImgs].slice(0, 8));
  };

  const removeImg = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    setErr(null);
    if (!name || !location || !description || !totalValue || !totalShares || !sharePrice || !returnRate) {
      setErr("Please fill all fields");
      return;
    }
    const finalImages = images.length > 0 ? images : [IMG_LIB[imgIdx]];
    setBusy(true);
    try {
      await api("/properties", {
        body: {
          name,
          property_type: propType,
          location,
          description,
          images: finalImages,
          documents: [],
          total_value: parseFloat(totalValue),
          total_shares: parseInt(totalShares),
          share_price: parseFloat(sharePrice),
          monthly_return_rate: parseFloat(returnRate),
        },
      });
      router.replace("/(company)/properties");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>List a property</Text>
          <Text style={styles.sub}>Awaiting admin approval before going live.</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing["3xl"] }} keyboardShouldPersistTaps="handled">
          <Field label="PROPERTY NAME">
            <TextInput testID="add-name" value={name} onChangeText={setName} placeholder="e.g. The Crescent Tower" placeholderTextColor={colors.info} style={styles.input} />
          </Field>

          <Text style={styles.miniLabel}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t} onPress={() => setPropType(t)} style={[styles.typePill, propType === t && styles.typePillActive]} testID={`add-type-${t.toLowerCase()}`}>
                <Text style={[styles.typeText, propType === t && { color: colors.brand }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Field label="LOCATION"><TextInput testID="add-location" value={location} onChangeText={setLocation} placeholder="Mumbai, India" placeholderTextColor={colors.info} style={styles.input} /></Field>
          <Field label="DESCRIPTION"><TextInput testID="add-description" value={description} onChangeText={setDescription} placeholder="A short description…" placeholderTextColor={colors.info} style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} multiline /></Field>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="TOTAL VALUE (₹)"><TextInput testID="add-value" value={totalValue} onChangeText={setTotalValue} keyboardType="numeric" placeholder="10000000" placeholderTextColor={colors.info} style={styles.input} /></Field></View>
            <View style={{ flex: 1 }}><Field label="RETURN % / MO"><TextInput testID="add-return" value={returnRate} onChangeText={setReturnRate} keyboardType="numeric" placeholder="1.2" placeholderTextColor={colors.info} style={styles.input} /></Field></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Field label="TOTAL SHARES"><TextInput testID="add-shares" value={totalShares} onChangeText={setTotalShares} keyboardType="numeric" placeholder="1000" placeholderTextColor={colors.info} style={styles.input} /></Field></View>
            <View style={{ flex: 1 }}><Field label="SHARE PRICE (₹)"><TextInput testID="add-price" value={sharePrice} onChangeText={setSharePrice} keyboardType="numeric" placeholder="10000" placeholderTextColor={colors.info} style={styles.input} /></Field></View>
          </View>

          <Text style={styles.miniLabel}>COVER IMAGES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <TouchableOpacity onPress={pickImages} style={styles.pickTile} testID="add-pick-images">
              <Ionicons name="add" color={colors.brand} size={28} />
              <Text style={{ color: colors.brand, fontSize: 11, marginTop: 2 }}>From device</Text>
            </TouchableOpacity>
            {images.map((u, i) => (
              <View key={`up-${i}`} style={styles.imgTile}>
                <Image source={{ uri: u }} style={{ width: "100%", height: "100%", borderRadius: radius.md }} resizeMode="cover" />
                <TouchableOpacity onPress={() => removeImg(i)} style={styles.removeChip} testID={`add-remove-${i}`}>
                  <Ionicons name="close-circle" color={colors.error} size={20} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length === 0 &&
              IMG_LIB.map((u, i) => (
                <TouchableOpacity key={i} onPress={() => setImgIdx(i)} style={[styles.imgTile, imgIdx === i && { borderColor: colors.brand, borderWidth: 2 }]} testID={`add-img-${i}`}>
                  <Image source={{ uri: u }} style={{ width: "100%", height: "100%", borderRadius: radius.md }} resizeMode="cover" />
                  {imgIdx === i && (
                    <View style={styles.selectedChip}>
                      <Text style={{ color: colors.brand, fontSize: 10 }}>SELECTED</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>

          {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}

          <View style={{ height: spacing.md }} />
          <GoldButton testID="add-submit-btn" title="Submit for approval" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: any) {
  return (
    <View>
      <Text style={styles.miniLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: 0 },
  title: { color: colors.onSurface, fontSize: 32, fontFamily: fonts.display },
  sub: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: 4 },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, marginTop: 6, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontSize: 15 },
  typePill: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  typePillActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  typeText: { color: colors.onSurfaceSecondary, fontSize: 13 },
  imgTile: { width: 120, height: 80, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  pickTile: { width: 120, height: 80, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed", backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  removeChip: { position: "absolute", top: 4, right: 4 },
  selectedChip: { position: "absolute", bottom: 4, left: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: "rgba(28,28,33,0.9)" },
});
