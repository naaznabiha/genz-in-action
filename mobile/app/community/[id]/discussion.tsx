import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AttachmentView, RoleChip } from "@/components/communities/community-bits";
import { CloseIcon, ImageIcon, PlusIcon } from "@/components/icons";
import AppText from "@/components/ui/app-text";
import Avatar from "@/components/ui/avatar";
import BottomSheet from "@/components/ui/bottom-sheet";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import Screen from "@/components/ui/screen";
import ScreenHeader from "@/components/ui/screen-header";
import { useToast } from "@/components/ui/toast";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import {
  useCommunity,
  useCommunitySync,
  useDeleteMessage,
  useJoinCommunity,
  useMessages,
  usePinned,
  useSendMessage,
  useStarred,
  useToggleStar,
  useTogglePin,
} from "@/hooks/use-communities";
import { formatBytes, pickCommunityPdf, pickCommunityPhoto } from "@/lib/attachments";
import { avatarPublicUrl } from "@/services/profile";
import type { CommunityMessage, PickedAttachment } from "@/types/community";

const MESSAGE_MAX = 2000;

type Row = { kind: "message"; message: CommunityMessage } | { kind: "day"; label: string; key: string };

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * Community discussion (approved boards Discussion + MessageActions). Live
 * through Supabase Realtime; newest at the bottom; 50 messages per page,
 * older pages load as you scroll up. Long-press a message to star it (only
 * you see your stars), pin it for everyone (owner/admins), copy or delete it
 * (your own; owner/admins: any). Chat messages never send notifications (D52).
 */
export default function DiscussionScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const community = useCommunity(id);
  const c = community.data;
  const canRead = Boolean(c?.can_read);
  const isMember = Boolean(c?.my_role);
  const staff = c?.my_role === "owner" || c?.my_role === "admin";

  const messages = useMessages(id, canRead);
  const pinned = usePinned(id, canRead);
  const starred = useStarred(id, isMember);
  useCommunitySync(id, canRead);
  const send = useSendMessage(id);
  const join = useJoinCommunity();
  const star = useToggleStar(id);
  const pin = useTogglePin(id);
  const del = useDeleteMessage(id);

  const [text, setText] = useState("");
  const [file, setFile] = useState<PickedAttachment | null>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<CommunityMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CommunityMessage | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);

  const rows: Row[] = useMemo(() => {
    const list = messages.data?.pages.flatMap((p) => p.messages) ?? [];
    const out: Row[] = [];
    list.forEach((m, i) => {
      out.push({ kind: "message", message: m });
      const older = list[i + 1];
      const label = dayLabel(m.created_at);
      // Inverted list: the separator after the last message of a day is drawn above it.
      if (!older || dayLabel(older.created_at) !== label) out.push({ kind: "day", label, key: `day:${m.id}` });
    });
    return out;
  }, [messages.data]);

  const starredCount = starred.data?.pages.reduce((n, p) => n + p.messages.length, 0) ?? 0;

  const pick = async (kind: "image" | "pdf") => {
    setAttachSheet(false);
    setPicking(true);
    try {
      const picked = kind === "image" ? await pickCommunityPhoto() : await pickCommunityPdf();
      if (picked) setFile(picked);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Couldn't open the file.", "error");
    } finally {
      setPicking(false);
    }
  };

  const onSend = () => {
    const body = text.trim();
    if ((!body && !file) || send.isPending) return;
    send.mutate(
      { body, file },
      {
        onSuccess: () => {
          setText("");
          setFile(null);
        },
        onError: (e) => toast.show(e.message, "error"),
      },
    );
  };

  const onEndReached = useCallback(() => {
    if (messages.hasNextPage && !messages.isFetchingNextPage && !messages.isError) void messages.fetchNextPage();
  }, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      item.kind === "day" ? (
        <AppText style={styles.day} color={Colors.text3} align="center">
          {item.label}
        </AppText>
      ) : (
        <MessageBubble message={item.message} mine={item.message.author_id === user?.id} highlighted={item.message.id === focus} onLongPress={setSelected} />
      ),
    [focus, user?.id],
  );

  const header = (
    <ScreenHeader
      back
      title={c?.name ?? "Discussion"}
      right={
        canRead ? (
          <View style={styles.headerRight}>
            <View style={styles.live} accessible accessibilityLabel="Live">
              <View style={styles.liveDot} />
              <AppText style={styles.liveText} color={Colors.green}>
                Live
              </AppText>
            </View>
            {isMember ? (
              <Pressable onPress={() => router.push(`/community/${id}/starred` as Href)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Starred messages, ${starredCount}`}>
                <AppText variant="captionSemiBold" color={Colors.gold}>
                  ★ {starredCount}
                  {starred.hasNextPage ? "+" : ""}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : undefined
      }
    />
  );

  if (community.isPending) {
    return (
      <Screen header={header} edges={["top", "bottom"]}>
        <ActivityIndicator color={Colors.cyan} style={styles.loading} />
      </Screen>
    );
  }
  if (!c || !canRead) {
    return (
      <Screen header={header} edges={["top", "bottom"]}>
        <EmptyState
          emoji="🔒"
          title="Members only"
          subtitle="This discussion is visible to members of the community only."
          action={<Button label="Go back" variant="secondary" size="md" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const pins = pinned.data ?? [];
  const selectedMine = selected?.author_id === user?.id;

  return (
    <Screen padded={false} header={header} edges={["top", "bottom"]}>
      {pins.length > 0 ? (
        <Pressable onPress={() => setPinsOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`${pins.length} pinned messages. ${pinsOpen ? "Hide" : "Show"} all`} style={styles.pinBanner}>
          <AppText style={styles.pinEyebrow} color={Colors.gold}>
            📌 {pins.length} PINNED
          </AppText>
          {(pinsOpen ? pins : pins.slice(0, 1)).map((p) => (
            <AppText key={p.id} variant="caption" color={Colors.text1} numberOfLines={pinsOpen ? 4 : 1}>
              <AppText variant="captionSemiBold" color={Colors.text2}>
                {p.author_display_name}:{" "}
              </AppText>
              {p.body || (p.attachment_kind === "pdf" ? `📄 ${p.attachment_name ?? "Document"}` : "📷 Photo")}
            </AppText>
          ))}
        </Pressable>
      ) : null}

      <FlatList<Row>
        inverted
        data={rows}
        keyExtractor={(r) => (r.kind === "day" ? r.key : r.message.id)}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.list}
        ListFooterComponent={messages.isFetchingNextPage ? <ActivityIndicator color={Colors.cyan} style={styles.more} /> : undefined}
        ListEmptyComponent={
          messages.isPending ? (
            <ActivityIndicator color={Colors.cyan} style={styles.loading} />
          ) : messages.isError ? (
            <View style={styles.flipped}>
              <EmptyState emoji="⚠️" title="Couldn't load messages" subtitle={messages.error.message} action={<Button label="Try again" variant="secondary" size="md" onPress={() => void messages.refetch()} />} />
            </View>
          ) : (
            <View style={styles.flipped}>
              <EmptyState emoji="💬" title="No messages yet" subtitle={isMember ? "Say hello to the community!" : "Join to start the conversation."} />
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {isMember ? (
        <View style={styles.composerWrap}>
          {file ? (
            <View style={styles.filePreview}>
              {file.kind === "image" ? <Image source={{ uri: file.uri }} style={styles.thumb} contentFit="cover" /> : <AppText style={styles.pdfTag}>PDF</AppText>}
              <AppText variant="caption" color={Colors.text2} style={styles.flex} numberOfLines={1}>
                {file.kind === "image" ? "Photo" : `${file.name} · ${formatBytes(file.size)}`}
              </AppText>
              <Pressable onPress={() => setFile(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove attachment">
                <CloseIcon size={16} color={Colors.text2} />
              </Pressable>
            </View>
          ) : (
            <AppText variant="caption" color={Colors.text3} style={styles.hint}>
              Long-press a message for more
            </AppText>
          )}
          <View style={styles.composer}>
            <Pressable onPress={() => setAttachSheet(true)} disabled={picking || send.isPending} hitSlop={6} accessibilityRole="button" accessibilityLabel="Attach a photo or PDF" style={styles.attach}>
              {picking ? <ActivityIndicator color={Colors.text2} /> : <PlusIcon size={20} color={Colors.text2} />}
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={MESSAGE_MAX}
              style={styles.input}
              selectionColor={Colors.cyanDim}
              cursorColor={Colors.cyan}
              accessibilityLabel="Message"
              editable={!send.isPending}
            />
            <Pressable
              onPress={onSend}
              disabled={(!text.trim() && !file) || send.isPending}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[styles.send, (!text.trim() && !file) && styles.sendOff]}
            >
              {send.isPending ? <ActivityIndicator color={Colors.bg} /> : <AppText style={styles.sendText} color={Colors.bg}>➤</AppText>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.composerWrap}>
          <Button
            label={c.is_private ? "Members only can post" : "Join to post"}
            variant="action"
            size="md"
            fullWidth
            disabled={c.is_private || c.my_status === "removed"}
            loading={join.isPending}
            onPress={() => join.mutate(id, { onError: (e) => toast.show(e.message, "error") })}
          />
        </View>
      )}

      <BottomSheet visible={attachSheet} onClose={() => setAttachSheet(false)} title="Attach" message="Photos up to 5 MB · PDFs up to 10 MB">
        <Button label="Photo" variant="secondary" fullWidth leftIcon={<ImageIcon size={18} color={Colors.text1} />} onPress={() => void pick("image")} />
        <Button label="PDF document" variant="secondary" fullWidth onPress={() => void pick("pdf")} />
      </BottomSheet>

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title="Message" message={selected?.body ? (selected.body.length > 120 ? `${selected.body.slice(0, 117)}…` : selected.body) : undefined}>
        {selected ? (
          <>
            {isMember ? (
              <Button
                label={selected.starred_by_me ? "Unstar" : "Star (only you see it)"}
                variant="secondary"
                fullWidth
                onPress={() => {
                  star.mutate({ messageId: selected.id, starred: !selected.starred_by_me }, { onError: (e) => toast.show(e.message, "error") });
                  setSelected(null);
                }}
              />
            ) : null}
            {staff ? (
              <Button
                label={selected.pinned ? "Unpin for everyone" : "Pin for everyone"}
                variant="secondary"
                fullWidth
                onPress={() => {
                  pin.mutate(
                    { messageId: selected.id, pinned: !selected.pinned },
                    { onSuccess: () => toast.show(selected.pinned ? "Unpinned" : "Pinned for everyone", "success"), onError: (e) => toast.show(e.message, "error") },
                  );
                  setSelected(null);
                }}
              />
            ) : null}
            {selected.body ? (
              <Button
                label="Copy text"
                variant="secondary"
                fullWidth
                onPress={() => {
                  void Clipboard.setStringAsync(selected.body).then(() => toast.show("Copied", "success"));
                  setSelected(null);
                }}
              />
            ) : null}
            {selectedMine || staff ? (
              <Button
                label="Delete"
                variant="destructive"
                fullWidth
                onPress={() => {
                  setConfirmDelete(selected);
                  setSelected(null);
                }}
              />
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete message?"
        message={confirmDelete && confirmDelete.author_id !== user?.id ? `This removes ${confirmDelete.author_display_name}'s message for everyone.` : "It's removed for everyone."}
      >
        <Button
          label="Delete"
          variant="danger"
          fullWidth
          loading={del.isPending}
          onPress={() =>
            confirmDelete &&
            del.mutate(confirmDelete, {
              onSuccess: () => setConfirmDelete(null),
              onError: (e) => toast.show(e.message, "error"),
            })
          }
        />
        <Button label="Cancel" variant="secondary" fullWidth onPress={() => setConfirmDelete(null)} />
      </BottomSheet>
    </Screen>
  );
}

const MessageBubble = memo(function MessageBubble({
  message: m,
  mine,
  highlighted,
  onLongPress,
}: {
  message: CommunityMessage;
  mine: boolean;
  highlighted: boolean;
  onLongPress: (m: CommunityMessage) => void;
}) {
  const router = useRouter();
  const label = `${mine ? "You" : m.author_display_name}, ${clock(m.created_at)}${m.pinned ? ", pinned" : ""}${m.starred_by_me ? ", starred" : ""}. ${m.body}`;
  return (
    <View style={[styles.msgRow, mine && styles.msgRowMine, highlighted && styles.highlight]}>
      {!mine ? (
        <Avatar
          name={m.author_display_name}
          uri={avatarPublicUrl(m.author_avatar_path)}
          size={32}
          onPress={() => router.push({ pathname: "/user/[id]", params: { id: m.author_id } })}
        />
      ) : null}
      <View style={[styles.msgCol, mine && styles.msgColMine]}>
        <View style={[styles.meta, mine && styles.metaMine]}>
          {!mine ? (
            <AppText variant="captionSemiBold" color={Colors.text1} numberOfLines={1}>
              {m.author_display_name}
            </AppText>
          ) : null}
          {!mine && (m.author_role === "owner" || m.author_role === "admin") ? <RoleChip role={m.author_role} /> : null}
          <AppText variant="caption" color={Colors.text3}>
            {mine ? `You · ${clock(m.created_at)}` : clock(m.created_at)}
          </AppText>
        </View>
        <Pressable
          onLongPress={() => onLongPress(m)}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Long-press for star, pin, copy and delete"
          accessibilityActions={[{ name: "longpress", label: "More actions" }]}
          onAccessibilityAction={() => onLongPress(m)}
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
        >
          {m.attachment ? (
            <View style={styles.attachment}>
              <AttachmentView attachment={m.attachment} compact />
            </View>
          ) : null}
          {m.body ? (
            <AppText variant="body" color={mine ? Colors.bg : Colors.text1}>
              {m.body}
            </AppText>
          ) : null}
        </Pressable>
        {m.pinned || m.starred_by_me ? (
          <AppText variant="caption" color={Colors.gold} style={mine ? styles.flagsMine : undefined}>
            {m.pinned ? "📌 Pinned" : ""}
            {m.pinned && m.starred_by_me ? " · " : ""}
            {m.starred_by_me ? "★ Starred" : ""}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  loading: { marginTop: 80 },
  flex: { flex: 1, minWidth: 0 },
  flipped: { transform: [{ scaleY: -1 }] },
  list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexGrow: 1 },
  more: { marginVertical: Spacing.lg },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  live: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  liveText: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 14 },
  pinBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: "rgba(255,215,0,0.07)", borderWidth: 1, borderColor: "rgba(255,215,0,0.25)", gap: 4 },
  pinEyebrow: { fontFamily: FontFamily.bold, fontSize: 10, lineHeight: 14, letterSpacing: 0.8 },
  day: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 14, marginVertical: Spacing.md },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm, marginVertical: 6, paddingVertical: 2, borderRadius: Radius.md },
  msgRowMine: { justifyContent: "flex-end" },
  highlight: { backgroundColor: "rgba(255,215,0,0.08)" },
  msgCol: { maxWidth: "80%", gap: 4, alignItems: "flex-start" },
  msgColMine: { alignItems: "flex-end" },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaMine: { justifyContent: "flex-end" },
  bubble: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 16, gap: Spacing.sm },
  bubbleOther: { backgroundColor: Colors.card, borderTopLeftRadius: 4, borderWidth: 1, borderColor: Colors.hairline },
  bubbleMine: { backgroundColor: Colors.cyan, borderTopRightRadius: 4 },
  attachment: { width: 240, maxWidth: "100%" },
  flagsMine: { textAlign: "right" },
  composerWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 6 },
  hint: { textAlign: "center" },
  filePreview: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.elevated },
  thumb: { width: 36, height: 36, borderRadius: 6 },
  pdfTag: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 14, color: Colors.red, paddingHorizontal: 6 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm },
  attach: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.elevated, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cyan, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
  sendText: { fontSize: 16, lineHeight: 20, fontFamily: FontFamily.bold },
});
