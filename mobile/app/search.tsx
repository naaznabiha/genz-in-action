import { useRouter } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";

import { HashtagRow } from "@/components/discovery/hashtag-rows";
import ListFooter from "@/components/discovery/list-footer";
import { ArrowLeftIcon, CloseIcon, SearchIcon } from "@/components/icons";
import PostCard from "@/components/posts/post-card";
import PersonRow from "@/components/social/person-row";
import AppText from "@/components/ui/app-text";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import IconButton from "@/components/ui/icon-button";
import Screen from "@/components/ui/screen";
import SegmentedTabs from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import TextField from "@/components/ui/text-field";
import { Colors, FontFamily, Spacing } from "@/constants/theme";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRecentSearches, useSearchHashtags, useSearchPosts, useSearchProfiles } from "@/hooks/use-discovery";
import type { HashtagHit, ProfileHit } from "@/types/discovery";
import type { Post } from "@/types/post";

type Tab = "all" | "people" | "posts" | "tags";
const TABS = [
  { value: "all", label: "All" },
  { value: "people", label: "People" },
  { value: "posts", label: "Posts" },
  { value: "tags", label: "Tags" },
] as const;

/** Typing waits this long before searching (one request set per pause, not per key). */
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_CHARS = 100;
/** How many of each kind the "All" tab previews. */
const PREVIEW = 3;

/** What actually gets searched: trimmed, single spaces, capped. */
function cleanQuery(text: string) {
  return text.trim().replace(/\s+/g, " ").slice(0, MAX_CHARS);
}

type Row = { kind: "person"; person: ProfileHit } | { kind: "post"; post: Post } | { kind: "tag"; tag: HashtagHit };

/**
 * Global Search (spec FR-14), opened from Home's search button and Explore's
 * search bar. People (exact @username first, then usernames starting with the
 * text, then names), Posts (every word, matched as a word start, in title or
 * text) and Hashtags (starting with the text). Results come from Postgres
 * full-text search and only include what the viewer may see. Recent searches
 * are stored on this device only.
 */
export default function SearchScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const recent = useRecentSearches();

  const typed = cleanQuery(text);
  const query = useDebouncedValue(typed, DEBOUNCE_MS);
  const active = query.length >= MIN_CHARS ? query : "";
  const settling = typed !== query;

  const people = useSearchProfiles(active);
  const posts = useSearchPosts(active);
  const tags = useSearchHashtags(active);

  const peopleList = useMemo(() => people.data?.pages.flatMap((p) => p.people) ?? [], [people.data]);
  const postList = useMemo(() => posts.data?.pages.flatMap((p) => p.posts) ?? [], [posts.data]);
  const tagList = useMemo(() => tags.data?.pages.flatMap((p) => p.tags) ?? [], [tags.data]);

  const { add: addRecent } = recent;
  /** Opening a result saves the search that produced it to this device's recent searches. */
  const remember = useCallback(() => {
    if (active) addRecent(active);
  }, [active, addRecent]);
  /** Pressing Search saves what was typed, even before the debounce has caught up. */
  const submit = () => {
    if (typed.length >= MIN_CHARS) addRecent(typed);
  };

  const pickRecent = (term: string) => {
    setText(term);
    addRecent(term);
  };

  // ------------------------------------------------------------ list for the selected tab
  const current = tab === "people" ? people : tab === "posts" ? posts : tab === "tags" ? tags : null;
  const rows: Row[] = useMemo(() => {
    if (tab === "people") return peopleList.map((person) => ({ kind: "person", person }));
    if (tab === "posts") return postList.map((post) => ({ kind: "post", post }));
    if (tab === "tags") return tagList.map((tag) => ({ kind: "tag", tag }));
    return [];
  }, [tab, peopleList, postList, tagList]);

  const onEndReached = useCallback(() => {
    if (current && current.hasNextPage && !current.isFetchingNextPage && !current.isError) void current.fetchNextPage();
  }, [current]);

  const renderRow = useCallback(
    ({ item }: { item: Row }) =>
      item.kind === "person" ? (
        <PersonRow person={item.person} relationship={item.person.relationship} onOpen={remember} />
      ) : item.kind === "tag" ? (
        <HashtagRow tag={item.tag} onOpen={remember} />
      ) : (
        <View style={styles.postItem}>
          <PostCard post={item.post} onOpen={remember} />
        </View>
      ),
    [remember],
  );

  // ------------------------------------------------------------ header (input + tabs)
  const searchBar = (
    <View style={styles.bar}>
      <IconButton icon={<ArrowLeftIcon size={18} color={Colors.text1} />} onPress={() => router.back()} accessibilityLabel="Go back" />
      <View style={styles.flex}>
        <TextField
          value={text}
          onChangeText={setText}
          placeholder="Search people, posts, #hashtags"
          accessibilityLabel="Search"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={submit}
          maxLength={MAX_CHARS}
          leftIcon={<SearchIcon size={18} color={Colors.text2} />}
          rightAccessory={
            text ? (
              <Pressable onPress={() => setText("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <CloseIcon size={16} color={Colors.text2} />
              </Pressable>
            ) : undefined
          }
        />
      </View>
    </View>
  );

  // ------------------------------------------------------------ bodies
  let body: ReactNode;
  if (!typed) {
    body =
      recent.items.length > 0 ? (
        <View style={styles.padded}>
          <View style={styles.sectionHead}>
            <AppText variant="bodyBold" style={styles.sectionTitle}>
              Recent searches
            </AppText>
            <Pressable onPress={recent.clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear all recent searches">
              <AppText variant="captionSemiBold" color={Colors.cyan}>
                Clear all
              </AppText>
            </Pressable>
          </View>
          {recent.items.map((term) => (
            <View key={term} style={styles.recentRow}>
              <Pressable
                onPress={() => pickRecent(term)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${term}`}
                style={({ pressed }) => [styles.recentTerm, pressed && styles.pressed]}
              >
                <SearchIcon size={16} color={Colors.text3} />
                <AppText variant="body" numberOfLines={1} style={styles.flex}>
                  {term}
                </AppText>
              </Pressable>
              <Pressable onPress={() => recent.remove(term)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${term} from recent searches`}>
                <CloseIcon size={14} color={Colors.text3} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          emoji="🔍"
          title="Search GenZ in Action"
          subtitle="Find people by name or @username, posts by any word, and #hashtags."
        />
      );
  } else if (typed.length < MIN_CHARS) {
    body = (
      <AppText variant="caption" color={Colors.text3} align="center" style={styles.hint}>
        Keep typing — at least {MIN_CHARS} characters.
      </AppText>
    );
  } else if (tab === "all") {
    body = (
      <AllResults
        query={active}
        settling={settling || !active}
        people={people}
        posts={posts}
        tags={tags}
        peopleList={peopleList}
        postList={postList}
        tagList={tagList}
        onSeeAll={setTab}
        remember={remember}
      />
    );
  } else {
    const q = current!;
    const noun = tab === "people" ? "people" : tab === "posts" ? "posts" : "hashtags";
    body = (
      <FlatList<Row>
        data={rows}
        keyExtractor={(r) => (r.kind === "person" ? `p:${r.person.id}` : r.kind === "post" ? `o:${r.post.id}` : `t:${r.tag.tag}`)}
        renderItem={renderRow}
        ItemSeparatorComponent={tab === "people" || tab === "tags" ? RowDivider : undefined}
        ListEmptyComponent={
          settling || !active || q.isPending ? (
            <ActivityIndicator color={Colors.cyan} style={styles.hint} accessibilityLabel="Searching" />
          ) : q.isError ? (
            <EmptyState
              emoji="⚠️"
              title="Search failed"
              subtitle={q.error?.message}
              action={<Button label="Try again" variant="secondary" size="md" onPress={() => void q.refetch()} />}
            />
          ) : (
            <EmptyState emoji="🔍" title={`No ${noun} for “${active}”`} subtitle="Try a different word or check the spelling." />
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={q.isFetchingNextPage}
            isFetchNextPageError={q.isFetchNextPageError}
            hasNextPage={Boolean(q.hasNextPage)}
            itemCount={rows.length}
            onRetry={() => void q.fetchNextPage()}
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      {searchBar}
      {typed.length >= MIN_CHARS ? (
        <View style={styles.tabs}>
          <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
        </View>
      ) : null}
      <View style={styles.flex}>{body}</View>
    </Screen>
  );
}

// -------------------------------------------------------------------- "All" tab
type InfiniteLike = {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  hasNextPage: boolean;
  refetch: () => unknown;
};

type AllResultsProps = {
  query: string;
  settling: boolean;
  people: InfiniteLike;
  posts: InfiniteLike;
  tags: InfiniteLike;
  peopleList: ProfileHit[];
  postList: Post[];
  tagList: HashtagHit[];
  onSeeAll: (tab: Tab) => void;
  remember: () => void;
};

/** Results grouped into People, Hashtags and Posts (first few of each, "See all" opens the tab). */
function AllResults({ query, settling, people, posts, tags, peopleList, postList, tagList, onSeeAll, remember }: AllResultsProps) {
  const loading = settling || people.isPending || posts.isPending || tags.isPending;
  const nothing = !loading && !people.isError && !posts.isError && !tags.isError && peopleList.length + postList.length + tagList.length === 0;

  if (nothing) {
    return <EmptyState emoji="🔍" title={`No results for “${query}”`} subtitle="Try a different word, a @username or a #hashtag." />;
  }

  const sections: { key: Tab; node: ReactNode }[] = [
    {
      key: "people",
      node: (
        <Section
          title="People"
          state={settling ? undefined : people}
          count={peopleList.length}
          more={peopleList.length > PREVIEW || people.hasNextPage}
          onSeeAll={() => onSeeAll("people")}
        >
          {peopleList.slice(0, PREVIEW).map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <RowDivider /> : null}
              <PersonRow person={p} relationship={p.relationship} onOpen={remember} />
            </View>
          ))}
        </Section>
      ),
    },
    {
      key: "tags",
      node: (
        <Section
          title="Hashtags"
          state={settling ? undefined : tags}
          count={tagList.length}
          more={tagList.length > PREVIEW || tags.hasNextPage}
          onSeeAll={() => onSeeAll("tags")}
        >
          {tagList.slice(0, PREVIEW).map((t, i) => (
            <View key={t.tag}>
              {i > 0 ? <RowDivider /> : null}
              <HashtagRow tag={t} onOpen={remember} />
            </View>
          ))}
        </Section>
      ),
    },
    {
      key: "posts",
      node: (
        <Section
          title="Posts"
          state={settling ? undefined : posts}
          count={postList.length}
          more={postList.length > PREVIEW || posts.hasNextPage}
          onSeeAll={() => onSeeAll("posts")}
        >
          <View style={styles.postStack}>
            {postList.slice(0, PREVIEW).map((p) => (
              <PostCard key={p.id} post={p} onOpen={remember} />
            ))}
          </View>
        </Section>
      ),
    },
  ];
  // "#…" puts hashtags first, "@…" puts people first; otherwise People, Hashtags, Posts.
  const first: Tab | null = query.startsWith("#") ? "tags" : query.startsWith("@") ? "people" : null;
  if (first) sections.sort((a, b) => (a.key === first ? -1 : b.key === first ? 1 : 0));

  return (
    <FlatList
      data={sections}
      keyExtractor={(s) => s.key}
      renderItem={({ item }) => <>{item.node}</>}
      contentContainerStyle={[styles.list, styles.allList]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    />
  );
}

type SectionProps = {
  title: string;
  /** Undefined while the user is still typing (shows the loading skeleton). */
  state: InfiniteLike | undefined;
  count: number;
  more: boolean;
  onSeeAll: () => void;
  children: ReactNode;
};

function Section({ title, state, count, more, onSeeAll, children }: SectionProps) {
  if (state && !state.isPending && !state.isError && count === 0) return null; // nothing of this kind
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText variant="bodyBold" style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </AppText>
        {state && !state.isPending && more ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`}>
            <AppText variant="captionSemiBold" color={Colors.cyan}>
              See all
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {!state || state.isPending ? (
        <View style={styles.skeletonRows} accessibilityLabel={`Searching ${title.toLowerCase()}`}>
          <Skeleton height={44} />
          <Skeleton height={44} />
        </View>
      ) : state.isError ? (
        <Pressable onPress={() => void state.refetch()} accessibilityRole="button" style={styles.sectionError}>
          <AppText variant="caption" color={Colors.red}>
            Couldn&apos;t search {title.toLowerCase()}. {state.error?.message} Tap to retry.
          </AppText>
        </Pressable>
      ) : (
        children
      )}
    </View>
  );
}

function RowDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bar: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  tabs: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  padded: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, flexGrow: 1 },
  allList: { gap: Spacing.xxl },
  hint: { marginTop: Spacing.xxl },
  pressed: { opacity: 0.7 },
  section: { gap: Spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: FontFamily.displayBold },
  sectionError: { paddingVertical: Spacing.md },
  skeletonRows: { gap: Spacing.sm },
  postStack: { gap: Spacing.lg },
  postItem: { marginBottom: Spacing.lg },
  recentRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  recentTerm: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.divider },
});
