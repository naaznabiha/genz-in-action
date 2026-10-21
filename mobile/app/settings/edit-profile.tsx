import { usePreventRemove, useNavigation } from "@react-navigation/native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { CheckIcon, ImageIcon, MapPinIcon } from "@/components/icons";
import TagChip from "@/components/profile/tag-chip";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useMyProfileTags, useTagCatalogue, useUpdateMyProfile } from "@/hooks/use-profile";
import { ProfileSaveError, toProfileSaveError, type ProfileField } from "@/lib/profile-errors";
import {
  AVATAR_MAX_BYTES,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  LOCATION_MAX,
  MAX_PROFILE_TAGS,
  USERNAME_MAX,
  normalizeUsername,
  validateBio,
  validateDisplayName,
  validateLocation,
  validateUsername,
} from "@/lib/validation";
import { isUsernameAvailable } from "@/services/auth";
import { avatarPublicUrl, deleteAvatarFile, uploadAvatar } from "@/services/profile";
import type { Profile, ProfileTag } from "@/types/profile";

/** Longest edge of the uploaded avatar. 512 px JPEG keeps uploads ~50–150 KB, far below the 5 MB limit. */
const AVATAR_SIZE = 512;

type Photo =
  | { kind: "unchanged" }
  | { kind: "new"; uri: string; base64: string }
  | { kind: "removed" };

type Availability = "own" | "idle" | "checking" | "available" | "taken" | "unknown";

/** Edit Profile (spec FR-18; prototype EditProfileScreen). Loads data, then renders the form. */
export default function EditProfileScreen() {
  const profile = useMyProfile();
  const tags = useMyProfileTags();
  const catalogue = useTagCatalogue();

  const loading = profile.isPending || tags.isPending || catalogue.isPending;
  const failed = profile.error ?? tags.error ?? catalogue.error;

  if (loading || failed || !profile.data || !tags.data || !catalogue.data) {
    return (
      <Screen header={<ScreenHeader title="Edit Profile" back />} edges={["top", "bottom"]}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.cyan} />
          </View>
        ) : (
          <EmptyState
            emoji="⚠️"
            title="Couldn't load your profile"
            subtitle={failed?.message ?? "No profile was found for this account."}
            action={
              <Button
                label="Try again"
                variant="secondary"
                size="md"
                onPress={() => {
                  void profile.refetch();
                  void tags.refetch();
                  void catalogue.refetch();
                }}
              />
            }
          />
        )}
      </Screen>
    );
  }

  return <EditProfileForm profile={profile.data} currentTags={tags.data} catalogue={catalogue.data} />;
}

function EditProfileForm({ profile, currentTags, catalogue }: { profile: Profile; currentTags: ProfileTag[]; catalogue: ProfileTag[] }) {
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();
  const updateProfile = useUpdateMyProfile();

  const initial = useMemo(
    () => ({
      displayName: profile.display_name,
      username: profile.username,
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      tagIds: currentTags.map((t) => t.id).sort(),
    }),
    [profile, currentTags],
  );

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [location, setLocation] = useState(initial.location);
  const [tagIds, setTagIds] = useState<string[]>(initial.tagIds);
  const [photo, setPhoto] = useState<Photo>({ kind: "unchanged" });
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [availability, setAvailability] = useState<Availability>("own");
  const [serverErrors, setServerErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  // ----- derived state -----
  const sortedTags = [...tagIds].sort();
  const dirty =
    displayName.trim() !== initial.displayName ||
    username !== initial.username ||
    bio.trim() !== initial.bio ||
    location.trim() !== initial.location ||
    sortedTags.join(",") !== initial.tagIds.join(",") ||
    photo.kind !== "unchanged";

  const fieldErrors: Partial<Record<ProfileField, string>> = {
    displayName: validateDisplayName(displayName),
    username: validateUsername(username) ?? (availability === "taken" ? "That username is already taken." : undefined),
    bio: validateBio(bio),
    location: validateLocation(location),
    tags: tagIds.length > MAX_PROFILE_TAGS ? `Choose up to ${MAX_PROFILE_TAGS} tags` : undefined,
  };
  const errorFor = (f: ProfileField) => serverErrors[f] ?? fieldErrors[f];
  const valid = Object.values(fieldErrors).every((e) => !e) && availability !== "checking";
  const canSave = dirty && valid && !saving && !processingPhoto;

  const currentAvatarUri =
    photo.kind === "new" ? photo.uri : photo.kind === "removed" ? null : avatarPublicUrl(profile.avatar_path);

  // ----- live username availability (server-side, case-insensitive) -----
  useEffect(() => {
    if (username === initial.username) {
      setAvailability("own");
      return;
    }
    if (validateUsername(username)) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const id = setTimeout(() => {
      isUsernameAvailable(username)
        .then((ok) => !cancelled && setAvailability(ok ? "available" : "taken"))
        .catch(() => !cancelled && setAvailability("unknown"));
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [username, initial.username]);

  // ----- leaving with unsaved changes asks first (back button, gesture, Android back) -----
  usePreventRemove(dirty && !saved, ({ data }) => {
    if (saving) return;
    setPendingLeave(() => () => navigation.dispatch(data.action));
  });

  useEffect(() => {
    if (saved) router.back();
  }, [saved, router]);

  const clearServerError = (field: ProfileField) => {
    setFormError(undefined);
    setServerErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  // ----- photo -----
  const pickPhoto = async () => {
    clearServerError("photo");
    try {
      // The system photo picker needs no media-library permission on Android 13+ / iOS 14+.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setProcessingPhoto(true);

      // Normalise every pick (HEIC, PNG, huge camera photos) to a small square-ish JPEG.
      // Both target dimensions are passed explicitly: letting the library derive one
      // (`height: null`) fails on web, and explicit sizes behave the same everywhere.
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 0 && asset.height > 0) {
        const scale = Math.min(1, AVATAR_SIZE / Math.max(asset.width, asset.height));
        context.resize({ width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) });
      }
      const image = await context.renderAsync();
      const output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });

      if (!output.base64) throw new Error("The photo could not be read. Try another one.");
      if (output.base64.length * 0.75 > AVATAR_MAX_BYTES) {
        throw new ProfileSaveError("That photo is larger than 5 MB. Choose a smaller one.", "photo");
      }
      if (mounted.current) setPhoto({ kind: "new", uri: output.uri, base64: output.base64 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo could not be opened.";
      if (mounted.current) setServerErrors((prev) => ({ ...prev, photo: message }));
    } finally {
      if (mounted.current) setProcessingPhoto(false);
    }
  };

  const removePhoto = () => {
    clearServerError("photo");
    setPhoto(profile.avatar_path ? { kind: "removed" } : { kind: "unchanged" });
  };

  // ----- tags -----
  const toggleTag = (id: string) => {
    clearServerError("tags");
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : prev.length >= MAX_PROFILE_TAGS ? prev : [...prev, id]));
  };

  // ----- save -----
  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    setFormError(undefined);
    setServerErrors({});
    let uploadedPath: string | null = null;
    try {
      let avatarPath = profile.avatar_path;
      if (photo.kind === "new") {
        uploadedPath = await uploadAvatar(user.id, photo.base64);
        avatarPath = uploadedPath;
      } else if (photo.kind === "removed") {
        avatarPath = null;
      }

      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        username,
        bio: bio.trim(),
        location: location.trim(),
        avatarPath,
        tagIds,
      });

      // The profile now points at the new photo (or none): the old file is unused.
      if (profile.avatar_path && avatarPath !== profile.avatar_path) void deleteAvatarFile(profile.avatar_path);
      toast.show("Profile updated", "success");
      setSaved(true);
    } catch (error) {
      // Nothing was saved (the RPC is atomic): drop the photo we just uploaded.
      if (uploadedPath) void deleteAvatarFile(uploadedPath);
      const err = toProfileSaveError(error);
      if (err.field === "username" && err.message.includes("taken")) setAvailability("taken");
      if (err.field) setServerErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const usernameHelper =
    availability === "checking"
      ? "Checking availability…"
      : availability === "available"
        ? `@${username} is available`
        : availability === "unknown"
          ? "Couldn't check availability. It will be checked when you save."
          : "Lowercase letters, numbers and underscores.";

  return (
    <Screen
      scroll
      edges={["top", "bottom"]}
      header={
        <ScreenHeader
          title="Edit Profile"
          back
          right={
            <Button
              label="Save"
              onPress={handleSave}
              loading={saving}
              disabled={!canSave}
              variant="action"
              size="sm"
              accessibilityHint={canSave ? undefined : "Make a valid change to enable saving"}
            />
          }
        />
      }
      contentStyle={styles.content}
    >
      {/* Photo */}
      <View style={styles.photoBlock}>
        <Pressable
          onPress={pickPhoto}
          disabled={saving || processingPhoto}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={styles.avatarWrap}
        >
          <Avatar name={displayName || profile.display_name} uri={currentAvatarUri} size={88} />
          <View style={styles.cameraBadge}>
            {processingPhoto ? <ActivityIndicator size="small" color={Colors.text1} /> : <ImageIcon size={14} color={Colors.text1} />}
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Button label="Change Photo" onPress={pickPhoto} variant="ghost" size="sm" disabled={saving || processingPhoto} />
          {currentAvatarUri ? (
            <Button label="Remove" onPress={removePhoto} variant="ghost" size="sm" disabled={saving || processingPhoto} />
          ) : null}
        </View>
        {errorFor("photo") ? (
          <AppText variant="caption" color={Colors.red} align="center" accessibilityLiveRegion="polite">
            {errorFor("photo")}
          </AppText>
        ) : photo.kind === "new" ? (
          <AppText variant="caption" color={Colors.text3} align="center">
            New photo selected. It uploads when you save.
          </AppText>
        ) : null}
      </View>

      <View style={styles.fields}>
        <TextField
          label="Display Name"
          placeholder="Your name"
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            clearServerError("displayName");
          }}
          error={errorFor("displayName")}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          editable={!saving}
        />

        <TextField
          label="Username"
          placeholder="username"
          value={username}
          onChangeText={(t) => {
            setUsername(normalizeUsername(t));
            clearServerError("username");
          }}
          error={errorFor("username")}
          helper={usernameHelper}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          textContentType="username"
          leftIcon={<AppText color={Colors.text3}>@</AppText>}
          rightAccessory={availability === "available" ? <CheckIcon size={16} color={Colors.green} /> : undefined}
          editable={!saving}
        />

        <TextField
          label="Bio"
          placeholder="Tell your story…"
          value={bio}
          onChangeText={(t) => {
            setBio(t);
            clearServerError("bio");
          }}
          error={errorFor("bio")}
          maxLength={BIO_MAX}
          showCount
          multiline
          autoCapitalize="sentences"
          autoCorrect
          editable={!saving}
        />

        <TextField
          label="Location"
          placeholder="City, Country"
          value={location}
          onChangeText={(t) => {
            setLocation(t);
            clearServerError("location");
          }}
          error={errorFor("location")}
          helper="Optional. Shown on your profile exactly as you type it."
          maxLength={LOCATION_MAX}
          autoCapitalize="words"
          leftIcon={<MapPinIcon size={16} color={Colors.text3} />}
          editable={!saving}
        />

        <View>
          <View style={styles.tagsHeader}>
            <AppText variant="bodyMedium" color={Colors.text2}>
              Tags
            </AppText>
            <AppText variant="caption" color={tagIds.length >= MAX_PROFILE_TAGS ? Colors.gold : Colors.text3}>
              {tagIds.length}/{MAX_PROFILE_TAGS} selected
            </AppText>
          </View>
          <View style={styles.tagGrid}>
            {catalogue.map((t) => (
              <TagChip
                key={t.id}
                id={t.id}
                label={t.label}
                selected={tagIds.includes(t.id)}
                disabled={saving || (tagIds.length >= MAX_PROFILE_TAGS && !tagIds.includes(t.id))}
                onPress={() => toggleTag(t.id)}
              />
            ))}
          </View>
          <AppText variant="caption" color={errorFor("tags") ? Colors.red : Colors.text3} style={styles.tagHelp}>
            {errorFor("tags") ?? "Pick up to 5 causes you care about."}
          </AppText>
        </View>
      </View>

      {formError ? (
        <AppText variant="body" color={Colors.red} style={styles.formError} accessibilityLiveRegion="polite">
          {formError}
        </AppText>
      ) : null}

      <BottomSheet
        visible={pendingLeave !== null}
        onClose={() => setPendingLeave(null)}
        title="Discard changes?"
        message="Your edits haven't been saved."
      >
        <Button
          label="Discard"
          variant="danger"
          fullWidth
          onPress={() => {
            const leave = pendingLeave;
            setPendingLeave(null);
            leave?.();
          }}
        />
        <Button label="Keep editing" variant="secondary" fullWidth onPress={() => setPendingLeave(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: Spacing.xxxl * 2 },
  photoBlock: { alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm, marginBottom: Spacing.xxl },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cyanDim,
    borderWidth: 2,
    borderColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: { flexDirection: "row", gap: Spacing.xs, marginTop: Spacing.sm },
  fields: { gap: Spacing.md },
  tagsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  tagHelp: { marginTop: Spacing.sm },
  formError: { marginTop: Spacing.lg },
});
