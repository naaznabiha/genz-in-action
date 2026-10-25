import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ImageIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useCommunity, useCreateCommunity, useUpdateCommunity } from "@/hooks/use-communities";
import { toCommunityError, type CommunityField } from "@/lib/community-errors";
import { pickAndPrepareImage } from "@/lib/image";
import { communityImageUrl, deleteCommunityImage, uploadCommunityImage } from "@/services/communities";

const NAME_MIN = 3;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;

type Cover = { kind: "none" } | { kind: "existing"; path: string } | { kind: "new"; uri: string; base64: string };

/**
 * Create a community (approved board "Create"): image, name (3–60),
 * description (≤500), Public / Private. You become its owner. Public
 * communities can be joined instantly; private ones are invite-only.
 * With ?id=… the same form edits the name, description and image
 * (owner/admin) — privacy is fixed once created.
 */
export default function CreateCommunityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const existing = useCommunity(id);
  const create = useCreateCommunity();
  const update = useUpdateCommunity(id ?? "none");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [cover, setCover] = useState<Cover>({ kind: "none" });
  const [errors, setErrors] = useState<Partial<Record<CommunityField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (editing && existing.data && !loaded) {
      setName(existing.data.name);
      setDescription(existing.data.description);
      setIsPrivate(existing.data.is_private);
      setCover(existing.data.image_path ? { kind: "existing", path: existing.data.image_path } : { kind: "none" });
      setLoaded(true);
    }
  }, [editing, existing.data, loaded]);

  const pick = async () => {
    setErrors((e) => ({ ...e, image: undefined }));
    setPicking(true);
    try {
      const img = await pickAndPrepareImage({ maxEdge: 800, square: true });
      if (img) setCover({ kind: "new", uri: img.uri, base64: img.base64 });
    } catch (e) {
      setErrors((x) => ({ ...x, image: e instanceof Error ? e.message : "The photo could not be opened." }));
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    const n = name.trim();
    const e: Partial<Record<CommunityField, string>> = {};
    if (n.length < NAME_MIN || n.length > NAME_MAX) e.name = `Names are ${NAME_MIN}–${NAME_MAX} characters`;
    if (description.trim().length > DESCRIPTION_MAX) e.description = `At most ${DESCRIPTION_MAX} characters`;
    setErrors(e);
    if (Object.keys(e).length || !user) return;
    setSaving(true);
    setFormError(undefined);
    let uploaded: string | null = null;
    try {
      if (cover.kind === "new") uploaded = await uploadCommunityImage(user.id, cover.base64);
      const imagePath = cover.kind === "new" ? uploaded : cover.kind === "existing" ? cover.path : null;
      if (editing && id) {
        const old = existing.data?.image_path ?? null;
        await update.mutateAsync({ name: n, description: description.trim(), imagePath });
        if (old && old !== imagePath && old.startsWith(`${user.id}/`)) void deleteCommunityImage(old);
        toast.show("Community updated", "success");
        router.back();
      } else {
        const newId = await create.mutateAsync({ name: n, description: description.trim(), imagePath, isPrivate });
        toast.show("Community created — you're the owner", "success");
        router.replace({ pathname: "/community/[id]", params: { id: newId } });
      }
    } catch (error) {
      if (uploaded) void deleteCommunityImage(uploaded);
      const err = toCommunityError(error);
      if (err.field === "name" || err.field === "description" || err.field === "image") setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const coverUri = cover.kind === "new" ? cover.uri : cover.kind === "existing" ? communityImageUrl(cover.path) : null;

  return (
    <Screen scroll header={<ScreenHeader title={editing ? "Edit community" : "Create community"} back />} edges={["top", "bottom"]} contentStyle={styles.content}>
      {editing && !loaded ? (
        <ActivityIndicator color={Colors.cyan} />
      ) : (
        <View style={styles.gap}>
          <View style={styles.coverRow}>
            <Pressable onPress={pick} disabled={picking || saving} accessibilityRole="button" accessibilityLabel={coverUri ? "Change community image" : "Add community image"} style={styles.cover}>
              {picking ? (
                <ActivityIndicator color={Colors.text2} />
              ) : coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverImage} contentFit="cover" />
              ) : (
                <ImageIcon size={24} color={Colors.text2} />
              )}
            </Pressable>
            <View style={styles.flex}>
              <AppText variant="bodySemiBold">Community image</AppText>
              <AppText variant="caption" color={Colors.text3}>
                Optional · square JPEG or PNG
              </AppText>
              {cover.kind !== "none" ? <Button label="Remove image" variant="ghost" size="sm" onPress={() => setCover({ kind: "none" })} style={styles.left} /> : null}
            </View>
          </View>
          {errors.image ? (
            <AppText variant="caption" color={Colors.red}>
              {errors.image}
            </AppText>
          ) : null}

          <TextField
            label="Name *"
            placeholder="e.g. Climate Builders"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
            maxLength={NAME_MAX}
            showCount
            error={errors.name}
            autoCapitalize="words"
            editable={!saving}
          />
          <TextField
            label="Description"
            placeholder="What is this community about? Who should join?"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setErrors((x) => ({ ...x, description: undefined }));
            }}
            maxLength={DESCRIPTION_MAX}
            showCount
            multiline
            error={errors.description}
            autoCapitalize="sentences"
            autoCorrect
            editable={!saving}
          />

          {!editing ? (
            <View style={styles.gapSm} accessibilityRole="radiogroup">
              <AppText variant="bodyMedium" color={Colors.text2}>
                Who can join?
              </AppText>
              <PrivacyOption
                title="Public"
                desc="Anyone can find it, read it and join instantly."
                selected={!isPrivate}
                onPress={() => setIsPrivate(false)}
              />
              <PrivacyOption
                title="Private"
                desc="Invite only. Only members can read the discussion and content."
                selected={isPrivate}
                onPress={() => setIsPrivate(true)}
              />
            </View>
          ) : (
            <AppText variant="caption" color={Colors.text3}>
              This community is {isPrivate ? "private (invite only)" : "public"}. Privacy can&apos;t be changed after it&apos;s created.
            </AppText>
          )}

          {formError ? (
            <AppText variant="body" color={Colors.red} accessibilityLiveRegion="polite">
              {formError}
            </AppText>
          ) : null}
          <Button label={editing ? "Save changes" : "Create community"} onPress={submit} loading={saving} fullWidth disabled={!name.trim()} />
        </View>
      )}
    </Screen>
  );
}

function PrivacyOption({ title, desc, selected, onPress }: { title: string; desc: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${desc}`}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={styles.flex}>
        <AppText variant="bodyBold">{title}</AppText>
        <AppText variant="caption" color={Colors.text2}>
          {desc}
        </AppText>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.sm },
  gap: { gap: Spacing.lg },
  gapSm: { gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  left: { alignSelf: "flex-start", paddingHorizontal: 0 },
  coverRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  cover: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: "100%" },
  option: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline },
  optionSelected: { borderColor: Colors.cyanDim, backgroundColor: Colors.elevated },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: Colors.cyanDim, backgroundColor: Colors.cyanDim },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.text1 },
});
