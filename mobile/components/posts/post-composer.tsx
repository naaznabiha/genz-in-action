import { usePreventRemove, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { CloseIcon, ImageIcon, MapPinIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import AppText from "@/components/ui/app-text";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import DateTimeField from "@/components/ui/date-time-field";
import Screen from "@/components/ui/screen";
import TextField from "@/components/ui/text-field";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { CommunityAvatar, PrivacyChip } from "@/components/communities/community-bits";
import { useAuth } from "@/hooks/use-auth";
import { useCommunities } from "@/hooks/use-communities";
import { useMyProfile, useTagCatalogue } from "@/hooks/use-profile";
import { extractHashtags } from "@/lib/hashtags";
import { pickAndPrepareImage } from "@/lib/image";
import { toPostError, type PostField } from "@/lib/post-errors";
import { POST_BODY_MAX, POST_BODY_MIN, POST_LOCATION_MAX, POST_TITLE_MAX, POST_TITLE_MIN } from "@/lib/validation";
import { deletePostImage, uploadPostImage } from "@/services/posts";
import { POST_TYPES, type Post, type PostInput, type PostType } from "@/types/post";

/** Longest edge of an uploaded post photo (JPEG). */
const POST_IMAGE_EDGE = 1600;

type Step = "type" | "content" | "details" | "preview";
const STEPS: Step[] = ["type", "content", "details", "preview"];
const STEP_LABELS = ["Type", "Content", "Details", "Preview"];

type Photo =
  | { kind: "none" }
  | { kind: "existing"; path: string; url: string | null; width: number | null; height: number | null }
  | { kind: "new"; uri: string; base64: string; width: number; height: number };

type PostComposerProps = {
  /** Present when editing an existing post. */
  initial?: Post;
  /** Saves the post (the photo, if any, is already uploaded). Returns the post id. */
  onSubmit: (input: PostInput) => Promise<string>;
  /** Called with the post id after a successful save (navigate away here). */
  onDone: (postId: string) => void;
  submitLabel: string;
};

/**
 * Create / edit wizard (prototype CreateScreen): type → content → details →
 * preview, trimmed to the agreed MVP fields (D24). Adds an optional photo; the
 * database detects #hashtags typed in the text. No petition goal, no sign /
 * RSVP / take-action buttons (D25). When creating, Details also asks "Who is
 * this post for?": Everyone, or one community you belong to (Phase 6, D51).
 * Editing keeps the audience.
 */
export default function PostComposer({ initial, onSubmit, onDone, submitLabel }: PostComposerProps) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const profile = useMyProfile();
  const catalogue = useTagCatalogue();
  const editing = Boolean(initial);

  const [step, setStep] = useState<Step>(editing ? "content" : "type");
  const [type, setType] = useState<PostType>(initial?.type ?? "action");
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [eventAt, setEventAt] = useState<Date | null>(initial?.event_at ? new Date(initial.event_at) : null);
  const [photo, setPhoto] = useState<Photo>(
    initial?.media_path
      ? { kind: "existing", path: initial.media_path, url: initial.media_url, width: initial.media_width, height: initial.media_height }
      : { kind: "none" },
  );
  const [errors, setErrors] = useState<Partial<Record<PostField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [donePostId, setDonePostId] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const myCommunities = useCommunities("mine");
  const communityOptions = useMemo(() => myCommunities.data?.pages.flatMap((p) => p.communities) ?? [], [myCommunities.data]);
  const audience = editing
    ? initial!.community_id
      ? { id: initial!.community_id, name: initial!.community_name ?? "a community", isPrivate: false }
      : null
    : (() => {
        const c = communityOptions.find((x) => x.id === communityId);
        return c ? { id: c.id, name: c.name, isPrivate: c.is_private } : null;
      })();

  // Navigate only after the "done" state is committed, so the unsaved-changes
  // guard is already off when the screen is removed.
  useEffect(() => {
    if (donePostId) {
      onDone(donePostId);
      if (!editing) setDonePostId(null);
    }
  }, [donePostId, editing, onDone]);

  const effectiveCategory = category ?? catalogue.data?.[0]?.id ?? null;
  const hashtags = useMemo(() => extractHashtags(`${title} ${body}`), [title, body]);
  const initialEventAt = initial?.event_at ? new Date(initial.event_at).getTime() : null;

  const dirty = editing
    ? type !== initial!.type ||
      effectiveCategory !== initial!.category ||
      title.trim() !== initial!.title ||
      body.trim() !== initial!.body ||
      location.trim() !== (initial!.location ?? "") ||
      (type === "event" ? eventAt?.getTime() ?? null : null) !== (initial!.type === "event" ? initialEventAt : null) ||
      photo.kind === "new" ||
      (photo.kind === "none" && Boolean(initial!.media_path))
    : Boolean(title || body || location || eventAt || photo.kind !== "none");

  // Editing: leaving with unsaved changes asks first. (Create is a tab; its draft simply stays.)
  usePreventRemove(editing && dirty && donePostId === null, ({ data }) => {
    if (saving) return;
    setPendingLeave(() => () => navigation.dispatch(data.action));
  });

  const contentErrors = (): Partial<Record<PostField, string>> => {
    const e: Partial<Record<PostField, string>> = {};
    const t = title.trim();
    const b = body.trim();
    if (!effectiveCategory) e.category = "Choose a category";
    if (t.length < POST_TITLE_MIN) e.title = `Title must be at least ${POST_TITLE_MIN} characters`;
    else if (t.length > POST_TITLE_MAX) e.title = `At most ${POST_TITLE_MAX} characters`;
    if (b.length < POST_BODY_MIN) e.body = `Please add more detail (at least ${POST_BODY_MIN} characters)`;
    else if (b.length > POST_BODY_MAX) e.body = `At most ${POST_BODY_MAX} characters`;
    return e;
  };

  const detailErrors = (): Partial<Record<PostField, string>> => {
    const e: Partial<Record<PostField, string>> = {};
    if (location.trim().length > POST_LOCATION_MAX) e.location = `At most ${POST_LOCATION_MAX} characters`;
    const changedDate = eventAt && eventAt.getTime() !== initialEventAt;
    if (type === "event" && changedDate && eventAt.getTime() < Date.now()) e.eventAt = "Pick a date in the future";
    return e;
  };

  const goNext = (from: Step) => {
    const e = from === "content" ? contentErrors() : from === "details" ? detailErrors() : {};
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(STEPS[STEPS.indexOf(from) + 1]);
  };

  const goBack = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);

  const pickPhoto = async () => {
    setErrors((e) => ({ ...e, photo: undefined }));
    setPicking(true);
    try {
      const picked = await pickAndPrepareImage({ maxEdge: POST_IMAGE_EDGE });
      if (picked) setPhoto({ kind: "new", ...picked });
    } catch (error) {
      setErrors((e) => ({ ...e, photo: error instanceof Error ? error.message : "The photo could not be opened." }));
    } finally {
      setPicking(false);
    }
  };

  const reset = () => {
    setStep("type");
    setType("action");
    setCategory(null);
    setTitle("");
    setBody("");
    setLocation("");
    setEventAt(null);
    setPhoto({ kind: "none" });
    setCommunityId(null);
    setErrors({});
    setFormError(undefined);
  };

  const submit = async () => {
    const e = { ...contentErrors(), ...detailErrors() };
    if (Object.keys(e).length) {
      setErrors(e);
      setStep(e.category || e.title || e.body ? "content" : "details");
      return;
    }
    if (!user || !effectiveCategory) return;
    setSaving(true);
    setFormError(undefined);
    let uploaded: string | null = null;
    try {
      let mediaPath: string | null = null;
      let mediaWidth: number | null = null;
      let mediaHeight: number | null = null;
      if (photo.kind === "new") {
        uploaded = await uploadPostImage(user.id, photo.base64);
        mediaPath = uploaded;
        mediaWidth = photo.width;
        mediaHeight = photo.height;
      } else if (photo.kind === "existing") {
        mediaPath = photo.path;
        mediaWidth = photo.width;
        mediaHeight = photo.height;
      }
      const postId = await onSubmit({
        type,
        category: effectiveCategory,
        title: title.trim(),
        body: body.trim(),
        location: location.trim(),
        eventAt: type === "event" && eventAt ? eventAt.toISOString() : null,
        mediaPath,
        mediaWidth,
        mediaHeight,
        communityId: editing ? undefined : audience?.id ?? null,
      });
      if (!editing) reset();
      setDonePostId(postId); // navigation happens after this state is applied (see effect)
    } catch (error) {
      if (uploaded) void deletePostImage(uploaded); // nothing was saved: drop the new upload
      const err = toPostError(error);
      if (err.field) {
        setErrors({ [err.field]: err.message });
        setStep(err.field === "location" || err.field === "eventAt" ? "details" : "content");
      } else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const previewPost: Post | null = profile.data
    ? {
        id: initial?.id ?? "preview",
        author_id: profile.data.id,
        author_username: profile.data.username,
        author_display_name: profile.data.display_name,
        author_avatar_path: profile.data.avatar_path,
        type,
        category: effectiveCategory ?? "climate",
        title: title.trim() || "Your title goes here",
        body: body.trim() || "Your description goes here…",
        location: location.trim() || null,
        event_at: type === "event" && eventAt ? eventAt.toISOString() : null,
        like_count: initial?.like_count ?? 0,
        comment_count: initial?.comment_count ?? 0,
        created_at: initial?.created_at ?? new Date().toISOString(),
        updated_at: initial?.created_at ?? new Date().toISOString(),
        media_path: null,
        media_width: null,
        media_height: null,
        media_url: photo.kind === "new" ? photo.uri : photo.kind === "existing" ? photo.url : null,
        liked_by_me: false,
        saved_by_me: false,
        community_id: audience?.id ?? null,
        community_name: audience?.name ?? null,
      }
    : null;

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <AppText variant="title" accessibilityRole="header">
          {editing ? "Edit Post" : "Create Action"}
        </AppText>
        {step !== "type" && !(editing && step === "content") ? (
          <Button label="Back" onPress={goBack} variant="ghost" size="sm" disabled={saving} />
        ) : editing ? (
          <Button label="Cancel" onPress={() => navigation.goBack()} variant="ghost" size="sm" disabled={saving} />
        ) : null}
      </View>
      <View style={styles.progress} accessible accessibilityLabel={`Step ${stepIndex + 1} of 4: ${STEP_LABELS[stepIndex]}`}>
        {STEP_LABELS.map((label, i) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.bar, { backgroundColor: i <= stepIndex ? Colors.cyanDim : Colors.elevated }]} />
            <AppText style={styles.progressLabel} color={i <= stepIndex ? Colors.cyan : Colors.text3}>
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Screen scroll header={header} edges={editing ? ["top", "bottom"] : ["top"]} contentStyle={styles.content}>
      {step === "type" ? (
        <View style={styles.gap}>
          <AppText variant="body" color={Colors.text2}>
            What kind of action are you creating?
          </AppText>
          {POST_TYPES.map((t) => {
            const selected = type === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setType(t.id);
                  setStep("content");
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${t.label}. ${t.desc}`}
                style={[styles.typeCard, selected && { borderColor: t.color, backgroundColor: Colors.elevated }]}
              >
                <View style={[styles.typeEmoji, { backgroundColor: `${t.color}33` }]}>
                  <AppText style={styles.emoji}>{t.emoji}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyBold">{t.label}</AppText>
                  <AppText variant="caption" color={Colors.text2}>
                    {t.desc}
                  </AppText>
                </View>
                <View style={[styles.radio, { borderColor: selected ? t.color : "rgba(255,255,255,0.2)", backgroundColor: selected ? t.color : "transparent" }]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === "content" ? (
        <View style={styles.gap}>
          {editing ? (
            <View>
              <AppText variant="bodyMedium" color={Colors.text2} style={styles.label}>
                Type
              </AppText>
              <View style={styles.chips}>
                {POST_TYPES.map((t) => (
                  <FilterChip key={t.id} label={t.label} selected={type === t.id} onPress={() => setType(t.id)} />
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <AppText variant="bodyMedium" color={Colors.text2} style={styles.label}>
              Category
            </AppText>
            {catalogue.isPending ? (
              <ActivityIndicator color={Colors.cyan} />
            ) : (
              <View style={styles.chips}>
                {(catalogue.data ?? []).map((c) => (
                  <FilterChip key={c.id} label={c.label} selected={effectiveCategory === c.id} onPress={() => setCategory(c.id)} />
                ))}
              </View>
            )}
            {errors.category ? (
              <AppText variant="caption" color={Colors.red}>
                {errors.category}
              </AppText>
            ) : null}
          </View>

          <TextField
            label="Title *"
            placeholder="Write a clear, compelling title…"
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setErrors((e) => ({ ...e, title: undefined }));
            }}
            maxLength={POST_TITLE_MAX}
            showCount
            error={errors.title}
            autoCapitalize="sentences"
            autoCorrect
            editable={!saving}
          />

          <TextField
            label="Description *"
            placeholder="Tell the story. Why does this matter? What can people do? Add #hashtags."
            value={body}
            onChangeText={(t) => {
              setBody(t);
              setErrors((e) => ({ ...e, body: undefined }));
            }}
            maxLength={POST_BODY_MAX}
            showCount
            multiline
            error={errors.body}
            autoCapitalize="sentences"
            autoCorrect
            editable={!saving}
          />

          {hashtags.length > 0 ? (
            <View style={styles.hashtags} accessibilityLabel={`Hashtags: ${hashtags.join(", ")}`}>
              {hashtags.map((h) => (
                <View key={h} style={styles.hashtag}>
                  <AppText variant="caption" color={Colors.cyan}>
                    #{h}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="caption" color={Colors.text3}>
              Tip: type #hashtags in your title or description and they are added automatically.
            </AppText>
          )}

          {photo.kind === "none" ? (
            <Pressable onPress={pickPhoto} disabled={picking || saving} accessibilityRole="button" accessibilityLabel="Add a photo" style={styles.addPhoto}>
              {picking ? <ActivityIndicator color={Colors.text2} /> : <ImageIcon size={18} color={Colors.text2} />}
              <AppText variant="body" color={Colors.text2}>
                Add a photo (optional)
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.photoWrap}>
              {photo.kind === "new" || photo.url ? (
                <Image source={{ uri: photo.kind === "new" ? photo.uri : (photo.url as string) }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.photoMissing]}>
                  <AppText variant="caption" color={Colors.text3}>
                    Current photo
                  </AppText>
                </View>
              )}
              <Pressable onPress={() => setPhoto({ kind: "none" })} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.removePhoto} disabled={saving}>
                <CloseIcon size={16} color={Colors.text1} />
              </Pressable>
              <Button label="Change photo" onPress={pickPhoto} variant="ghost" size="sm" disabled={picking || saving} />
            </View>
          )}
          {errors.photo ? (
            <AppText variant="caption" color={Colors.red} accessibilityLiveRegion="polite">
              {errors.photo}
            </AppText>
          ) : null}

          <Button label="Continue" onPress={() => goNext("content")} fullWidth disabled={!title.trim() || !body.trim() || saving} />
        </View>
      ) : null}

      {step === "details" ? (
        <View style={styles.gap}>
          <AppText variant="body" color={Colors.text2}>
            Add optional details to help people take action.
          </AppText>
          {type === "event" ? (
            <DateTimeField
              label="Event date & time"
              value={eventAt}
              onChange={(d) => {
                setEventAt(d);
                setErrors((e) => ({ ...e, eventAt: undefined }));
              }}
              minimumDate={new Date()}
              error={errors.eventAt}
            />
          ) : null}
          <TextField
            label="Location (optional)"
            placeholder="City, Country or Online"
            value={location}
            onChangeText={(t) => {
              setLocation(t);
              setErrors((e) => ({ ...e, location: undefined }));
            }}
            maxLength={POST_LOCATION_MAX}
            error={errors.location}
            leftIcon={<MapPinIcon size={16} color={Colors.text3} />}
            autoCapitalize="words"
            editable={!saving}
          />
          {!editing ? (
            <View style={styles.audience} accessibilityRole="radiogroup">
              <AppText variant="bodyMedium" color={Colors.text2}>
                Who is this post for?
              </AppText>
              <AudienceOption title="Everyone" desc="Your followers and the Home feed" selected={communityId === null} onPress={() => setCommunityId(null)} />
              {communityOptions.length > 0 ? (
                <AppText variant="caption" color={Colors.text3}>
                  Or one community you belong to
                </AppText>
              ) : myCommunities.isPending ? null : (
                <AppText variant="caption" color={Colors.text3}>
                  Join a community in Explore to share posts with it.
                </AppText>
              )}
              {communityOptions.map((c) => (
                <AudienceOption
                  key={c.id}
                  title={c.name}
                  desc={c.is_private ? "Only members can see it" : "Members see it in Home; anyone can open it"}
                  selected={communityId === c.id}
                  onPress={() => setCommunityId(c.id)}
                  icon={<CommunityAvatar id={c.id} name={c.name} imagePath={c.image_path} size={32} />}
                  chip={<PrivacyChip isPrivate={c.is_private} short />}
                />
              ))}
              {myCommunities.hasNextPage ? (
                <Button label="Show more communities" variant="ghost" size="sm" onPress={() => void myCommunities.fetchNextPage()} loading={myCommunities.isFetchingNextPage} />
              ) : null}
            </View>
          ) : null}
          <Button label="Preview" onPress={() => goNext("details")} fullWidth />
        </View>
      ) : null}

      {step === "preview" ? (
        <View style={styles.gap}>
          <AppText variant="body" color={Colors.text2}>
            Here is how your post will look to others.
          </AppText>
          {previewPost ? <PostCard post={previewPost} preview /> : <ActivityIndicator color={Colors.cyan} />}
          <View style={styles.readyBox}>
            <AppText variant="bodySemiBold" color={Colors.gold}>
              ✅ Ready to {editing ? "save" : "publish"}
            </AppText>
            <AppText variant="caption" color={Colors.text2}>
              {audience
                ? audience.isPrivate
                  ? `Shared to ${audience.name}: only its members will see this post.`
                  : `Shared to ${audience.name}: its members see it in Home, and anyone can open it.`
                : profile.data?.is_private
                  ? "Your account is private: only you and your approved followers will see this post."
                  : "Your post will be visible to everyone on GenZ in Action."}
            </AppText>
          </View>
          {formError ? (
            <AppText variant="body" color={Colors.red} accessibilityLiveRegion="polite">
              {formError}
            </AppText>
          ) : null}
          <Button label={submitLabel} onPress={submit} loading={saving} fullWidth disabled={editing && !dirty} />
          <Button label="Edit" onPress={() => setStep("content")} variant="ghost" size="md" fullWidth disabled={saving} />
        </View>
      ) : null}

      <BottomSheet visible={pendingLeave !== null} onClose={() => setPendingLeave(null)} title="Discard changes?" message="Your edits haven't been saved.">
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

function AudienceOption({ title, desc, selected, onPress, icon, chip }: { title: string; desc: string; selected: boolean; onPress: () => void; icon?: ReactNode; chip?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${desc}`}
      style={[styles.audienceOption, selected && styles.audienceSelected]}
    >
      {icon}
      <View style={styles.flex}>
        <View style={styles.audienceTitle}>
          <AppText variant="bodySemiBold" numberOfLines={1} style={styles.shrink}>
            {title}
          </AppText>
          {chip}
        </View>
        <AppText variant="caption" color={Colors.text2}>
          {desc}
        </AppText>
      </View>
      <View style={[styles.radio, { borderColor: selected ? Colors.cyanDim : "rgba(255,255,255,0.2)", backgroundColor: selected ? Colors.cyanDim : "transparent" }]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 140 },
  audience: { gap: Spacing.sm },
  audienceOption: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.hairline },
  audienceSelected: { borderColor: Colors.cyanDim, backgroundColor: Colors.elevated },
  audienceTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  shrink: { flexShrink: 1 },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  progress: { flexDirection: "row", gap: Spacing.sm },
  progressItem: { flex: 1, gap: 6 },
  bar: { height: 6, borderRadius: 3 },
  progressLabel: { fontFamily: FontFamily.medium, fontSize: 10, lineHeight: 12 },
  gap: { gap: Spacing.lg },
  flex: { flex: 1 },
  label: { marginBottom: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  typeEmoji: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24, lineHeight: 30 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.text1 },
  hashtags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  hashtag: { backgroundColor: Colors.elevated, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  addPhoto: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: Colors.card,
  },
  photoWrap: { gap: Spacing.xs, alignItems: "flex-start" },
  photo: { width: "100%", aspectRatio: 16 / 9, borderRadius: Radius.md, backgroundColor: Colors.elevated },
  photoMissing: { alignItems: "center", justifyContent: "center" },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8,8,15,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  readyBox: { padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.elevated, gap: 4 },
});
