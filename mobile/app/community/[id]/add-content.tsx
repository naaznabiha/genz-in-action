import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CloseIcon, ImageIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import TextField from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAddContent, useCommunity } from "@/hooks/use-communities";
import { formatBytes, pickCommunityPdf, pickCommunityPhoto } from "@/lib/attachments";
import { toCommunityError, type CommunityField } from "@/lib/community-errors";
import type { PickedAttachment } from "@/types/community";

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const BODY_MAX = 5000;

/**
 * Add lasting content to a community (approved board "AddContent"): a title,
 * text, and optionally one photo (JPEG/PNG, resized, ≤5 MB) or PDF (≤10 MB).
 * Every other member is notified (respecting Activity Updates). It stays
 * after you leave; you (or an admin) can delete it.
 */
export default function AddContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const community = useCommunity(id);
  const add = useAddContent(id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<PickedAttachment | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CommunityField, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [picking, setPicking] = useState(false);

  const pick = async (kind: "image" | "pdf") => {
    setErrors((e) => ({ ...e, attachment: undefined }));
    setPicking(true);
    try {
      const picked = kind === "image" ? await pickCommunityPhoto() : await pickCommunityPdf();
      if (picked) setFile(picked);
    } catch (e) {
      setErrors((x) => ({ ...x, attachment: e instanceof Error ? e.message : "Couldn't open the file." }));
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    const t = title.trim();
    const e: Partial<Record<CommunityField, string>> = {};
    if (t.length < TITLE_MIN || t.length > TITLE_MAX) e.title = `Titles are ${TITLE_MIN}–${TITLE_MAX} characters`;
    if (body.trim().length > BODY_MAX) e.body = `At most ${BODY_MAX.toLocaleString()} characters`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setFormError(undefined);
    try {
      const contentId = await add.mutateAsync({ title: t, body, file });
      toast.show("Added to the community", "success");
      router.replace({ pathname: "/community-content/[id]", params: { id: contentId } });
    } catch (error) {
      const err = toCommunityError(error);
      if (err.field === "title" || err.field === "body" || err.field === "attachment") setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    }
  };

  const notMember = community.data && !community.data.my_role;

  return (
    <Screen scroll header={<ScreenHeader back title="Add content" />} edges={["top", "bottom"]} contentStyle={styles.content}>
      {notMember ? (
        <AppText variant="body" color={Colors.text2}>
          Only members can add content to this community.
        </AppText>
      ) : (
        <View style={styles.gap}>
          {community.data ? (
            <AppText variant="caption" color={Colors.text3}>
              Sharing to {community.data.name}. Members are notified, and it stays even if you leave.
            </AppText>
          ) : null}
          <TextField
            label="Title *"
            placeholder="e.g. How we ran our school energy audit"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              setErrors((x) => ({ ...x, title: undefined }));
            }}
            maxLength={TITLE_MAX}
            showCount
            error={errors.title}
            autoCapitalize="sentences"
            autoCorrect
            editable={!add.isPending}
          />
          <TextField
            label="Text"
            placeholder="Write the guide, notes or context…"
            value={body}
            onChangeText={(v) => {
              setBody(v);
              setErrors((x) => ({ ...x, body: undefined }));
            }}
            maxLength={BODY_MAX}
            showCount
            multiline
            error={errors.body}
            autoCapitalize="sentences"
            autoCorrect
            editable={!add.isPending}
          />

          <View style={styles.gapSm}>
            <AppText variant="bodyMedium" color={Colors.text2}>
              Attachment (optional)
            </AppText>
            {file ? (
              <View style={styles.file}>
                {file.kind === "image" ? <Image source={{ uri: file.uri }} style={styles.thumb} contentFit="cover" /> : <AppText style={styles.pdfTag}>PDF</AppText>}
                <AppText variant="body" style={styles.flex} numberOfLines={1}>
                  {file.kind === "image" ? "Photo" : `${file.name} · ${formatBytes(file.size)}`}
                </AppText>
                <Pressable onPress={() => setFile(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove attachment" disabled={add.isPending}>
                  <CloseIcon size={18} color={Colors.text2} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.row}>
                <Button label="Photo" variant="secondary" size="md" leftIcon={<ImageIcon size={16} color={Colors.text1} />} onPress={() => void pick("image")} disabled={picking} style={styles.flex} />
                <Button label="PDF" variant="secondary" size="md" onPress={() => void pick("pdf")} disabled={picking} style={styles.flex} />
              </View>
            )}
            <AppText variant="caption" color={errors.attachment ? Colors.red : Colors.text3}>
              {errors.attachment ?? "One photo (JPEG/PNG, up to 5 MB) or one PDF (up to 10 MB)."}
            </AppText>
          </View>

          {formError ? (
            <AppText variant="body" color={Colors.red} accessibilityLiveRegion="polite">
              {formError}
            </AppText>
          ) : null}
          <Button label="Add to community" onPress={submit} loading={add.isPending} fullWidth disabled={!title.trim()} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.sm },
  gap: { gap: Spacing.lg },
  gapSm: { gap: Spacing.sm },
  row: { flexDirection: "row", gap: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  file: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.elevated },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  pdfTag: { fontFamily: FontFamily.bold, fontSize: 12, lineHeight: 16, color: Colors.red, paddingHorizontal: 8 },
});
