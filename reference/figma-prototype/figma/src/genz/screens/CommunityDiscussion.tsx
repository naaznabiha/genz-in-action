import { useMemo, useState } from 'react';
import { Avatar, StatusBar } from '../components/SharedUI';
import { CloseIcon, DotsIcon, ImageIcon, LinkIcon } from '../components/Icons';
import {
  CommunityMessage,
  communityMessages,
  pinnedMessageIds,
  starredMessageIds,
} from '../communityData';
import { currentUser } from '../data';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEV = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const GOLD = '#FFD700';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.15)';

/* ─── Icons local to discussion ─────────────────────────────── */

export function StarIcon({ size = 18, color = TEXT3, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path
        d="M12 3l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 16.77l-5.4 2.85 1.03-6.01L3.26 9.35l6.04-.88L12 3z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PinIcon({ size = 16, color = GOLD, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <path
        d="M14.5 3.5l6 6-2.4.6-3.3 3.3.5 4.2-2 1.2-4.1-4.1-4.3 4.3-1-1 4.3-4.3-4.1-4.1 1.2-2 4.2.5 3.3-3.3.6-2.4z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-8-6 8 6 8-16-8z" stroke={BG} strokeWidth="1.8" strokeLinejoin="round" fill={BG} fillOpacity="0.15" />
    </svg>
  );
}

/* ─── Shared discussion state hook ──────────────────────────── */

export type DiscussionState = ReturnType<typeof useDiscussion>;

export function useDiscussion(isAdmin: boolean) {
  const [messages, setMessages] = useState<CommunityMessage[]>(communityMessages);
  const [pinned, setPinned] = useState<Set<string>>(new Set(pinnedMessageIds));
  const [starred, setStarred] = useState<Set<string>>(new Set(starredMessageIds));
  const [toast, setToast] = useState('');

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1900);
  };

  const togglePin = (id: string) => {
    if (!isAdmin) {
      flash('Only admins can pin messages');
      return;
    }
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        flash('Message unpinned');
      } else {
        if (next.size >= 3) {
          flash('Pin limit reached — unpin one first');
          return prev;
        }
        next.add(id);
        flash('Pinned to the top of the discussion');
      }
      return next;
    });
  };

  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        flash('Removed from Starred');
      } else {
        next.add(id);
        flash('Saved to Starred messages');
      }
      return next;
    });
  };

  const send = (body: string) => {
    const msg: CommunityMessage = {
      id: `m${Date.now()}`,
      authorId: 'me',
      name: currentUser.displayName,
      username: currentUser.username,
      avatar: currentUser.avatar,
      body,
      timestamp: 'Just now',
      ...(isAdmin ? { role: 'Admin' as const } : {}),
    };
    setMessages(prev => [...prev, msg]);
  };

  return { messages, pinned, starred, togglePin, toggleStar, send, toast, isAdmin };
}

/* ─── Message row ───────────────────────────────────────────── */

function MessageRow({
  msg,
  state,
  onOpenActions,
}: {
  msg: CommunityMessage;
  state: DiscussionState;
  onOpenActions: (m: CommunityMessage) => void;
}) {
  const isStarred = state.starred.has(msg.id);
  const isPinned = state.pinned.has(msg.id);
  const isMine = msg.authorId === 'me';

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: isMine ? 'rgba(0,191,191,0.08)' : CARD,
        border: isPinned ? `1px solid ${GOLD}55` : `1px solid rgba(255,255,255,0.07)`,
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar src={msg.avatar} size={34} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold" style={{ color: TEXT1 }}>{msg.name}</span>
            {msg.role && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{
                  background: msg.role === 'Admin' ? 'rgba(0,255,255,0.12)' : 'rgba(167,139,250,0.14)',
                  color: msg.role === 'Admin' ? CYAN : '#A78BFA',
                }}
              >
                {msg.role}
              </span>
            )}
            {isPinned && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,215,0,0.12)', color: GOLD }}>
                <PinIcon size={9} color={GOLD} filled /> PINNED
              </span>
            )}
            <span className="text-[11px]" style={{ color: TEXT3 }}>· {msg.timestamp}</span>
          </div>

          <p className="text-sm leading-relaxed mt-1.5" style={{ color: TEXT2 }}>{msg.body}</p>

          {msg.attachment && (
            <div
              className="mt-2.5 flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: ELEV, border: `1px solid ${BORDER}` }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,255,255,0.08)' }}>
                {msg.attachment.kind === 'image'
                  ? <ImageIcon size={15} color={CYAN} />
                  : <LinkIcon size={15} color={CYAN} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: TEXT1 }}>{msg.attachment.label}</p>
                <p className="text-[10px]" style={{ color: TEXT3 }}>{msg.attachment.meta}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2.5">
            {msg.reactions?.map(r => (
              <span
                key={r.emoji}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: ELEV, color: TEXT2, border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <button
            onClick={() => state.toggleStar(msg.id)}
            aria-label={isStarred ? 'Unstar message' : 'Star message'}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: isStarred ? 'rgba(255,215,0,0.12)' : ELEV }}
          >
            <StarIcon size={16} color={isStarred ? GOLD : TEXT3} filled={isStarred} />
          </button>
          <button
            onClick={() => onOpenActions(msg)}
            aria-label="Message actions"
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: ELEV }}
          >
            <DotsIcon size={16} color={TEXT3} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pinned banner ─────────────────────────────────────────── */

function PinnedBanner({
  state,
  onExpand,
  expanded,
}: {
  state: DiscussionState;
  onExpand: () => void;
  expanded: boolean;
}) {
  const pinnedMsgs = state.messages.filter(m => state.pinned.has(m.id));
  if (pinnedMsgs.length === 0) return null;
  const first = pinnedMsgs[0];

  return (
    <div className="px-5 pb-2" style={{ flexShrink: 0 }}>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,215,0,0.06)', border: `1px solid ${GOLD}33` }}>
        <button onClick={onExpand} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left">
          <PinIcon size={15} color={GOLD} filled />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
              {pinnedMsgs.length} pinned message{pinnedMsgs.length > 1 ? 's' : ''}
            </p>
            {!expanded && first && (
              <p className="text-xs truncate" style={{ color: TEXT2 }}>
                <span style={{ color: TEXT1, fontWeight: 600 }}>{first.name}: </span>{first.body}
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <path d="M6 9l6 6 6-6" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {expanded && (
          <div className="px-3.5 pb-3 flex flex-col gap-2 animate-fade-in">
            {pinnedMsgs.map(m => (
              <div key={m.id} className="rounded-xl p-3" style={{ background: ELEV }}>
                <div className="flex items-center gap-2 mb-1">
                  <Avatar src={m.avatar} size={20} />
                  <span className="text-xs font-bold" style={{ color: TEXT1 }}>{m.name}</span>
                  <span className="text-[10px]" style={{ color: TEXT3 }}>{m.timestamp}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>{m.body}</p>
                {state.isAdmin && (
                  <button
                    onClick={() => state.togglePin(m.id)}
                    className="mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,85,85,0.1)', color: '#FF5555' }}
                  >
                    Unpin message
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Action sheet ──────────────────────────────────────────── */

function MessageActionSheet({
  msg,
  state,
  onClose,
}: {
  msg: CommunityMessage;
  state: DiscussionState;
  onClose: () => void;
}) {
  const isPinned = state.pinned.has(msg.id);
  const isStarred = state.starred.has(msg.id);

  const rows = [
    {
      icon: <StarIcon size={17} color={GOLD} filled={isStarred} />,
      label: isStarred ? 'Remove from Starred' : 'Star this message',
      sub: isStarred ? 'It will leave your Starred list' : 'Save it to your Starred messages',
      onPress: () => { state.toggleStar(msg.id); onClose(); },
      locked: false,
    },
    {
      icon: <PinIcon size={17} color={state.isAdmin ? GOLD : TEXT3} filled={isPinned} />,
      label: isPinned ? 'Unpin from discussion' : 'Pin to discussion',
      sub: state.isAdmin ? 'Pinned messages sit at the top for everyone' : 'Admins only',
      onPress: () => { state.togglePin(msg.id); onClose(); },
      locked: !state.isAdmin,
    },
    {
      icon: <LinkIcon size={17} color={CYAN} />,
      label: 'Copy link to message',
      sub: 'Share it outside the community',
      onPress: onClose,
      locked: false,
    },
    {
      icon: <span className="text-sm">🚩</span>,
      label: 'Report message',
      sub: 'Send to moderators for review',
      onPress: onClose,
      locked: false,
    },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl p-5 animate-slide-up"
        style={{ background: CARD, border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 pr-4">
            <p className="text-sm font-bold" style={{ color: TEXT1 }}>{msg.name}</p>
            <p className="text-xs line-clamp-2" style={{ color: TEXT3 }}>{msg.body}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ELEV }}>
            <CloseIcon size={15} color={TEXT2} />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: ELEV }}>
          {rows.map((r, i) => (
            <button
              key={r.label}
              onClick={r.onPress}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left"
              style={{ borderTop: i ? '1px solid rgba(255,255,255,0.05)' : 'none', opacity: r.locked ? 0.55 : 1 }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: TEXT1 }}>{r.label}</p>
                <p className="text-[11px]" style={{ color: TEXT3 }}>{r.sub}</p>
              </div>
              {r.locked && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: TEXT3 }}>
                  ADMIN
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Discussion panel ──────────────────────────────────────── */

export function DiscussionPanel({
  state,
  canPost,
  onOpenStarred,
  lockedNote,
}: {
  state: DiscussionState;
  canPost: boolean;
  onOpenStarred: () => void;
  lockedNote?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [actionMsg, setActionMsg] = useState<CommunityMessage | null>(null);

  const starredCount = state.starred.size;

  return (
    <div className="flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
      <PinnedBanner state={state} expanded={expanded} onExpand={() => setExpanded(e => !e)} />

      <div className="px-5 pb-2 flex items-center justify-between" style={{ flexShrink: 0 }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>
          {state.messages.length} messages · {state.isAdmin ? 'You are an admin' : 'Member view'}
        </p>
        <button
          onClick={onOpenStarred}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(255,215,0,0.1)', color: GOLD }}
        >
          <StarIcon size={12} color={GOLD} filled /> Starred · {starredCount}
        </button>
      </div>

      <div className="screen-body px-5">
        <div className="flex flex-col gap-2.5 pb-4">
          {state.messages.map(m => (
            <MessageRow key={m.id} msg={m} state={state} onOpenActions={setActionMsg} />
          ))}
        </div>
      </div>

      {canPost ? (
        <div className="px-5 py-3" style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', background: BG }}>
          <div className="flex items-end gap-2">
            <button className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
              <ImageIcon size={17} color={CYAN} />
            </button>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={1}
              placeholder="Share an update with the community…"
              className="flex-1 rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ background: ELEV, color: TEXT1, border: `1px solid ${BORDER}`, maxHeight: 96 }}
            />
            <button
              onClick={() => { if (draft.trim()) { state.send(draft.trim()); setDraft(''); } }}
              disabled={!draft.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
              style={{ background: draft.trim() ? CYAN : '#0F3B52', opacity: draft.trim() ? 1 : 0.6 }}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 py-4" style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="rounded-2xl px-4 py-3 text-center" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: TEXT2 }}>{lockedNote ?? 'Join this community to post in the discussion.'}</p>
          </div>
        </div>
      )}

      {state.toast && (
        <div className="absolute left-0 right-0 flex justify-center z-50" style={{ bottom: 92 }}>
          <div className="px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in" style={{ background: CARD, color: TEXT1, border: `1px solid ${BORDER}` }}>
            {state.toast}
          </div>
        </div>
      )}

      {actionMsg && <MessageActionSheet msg={actionMsg} state={state} onClose={() => setActionMsg(null)} />}
    </div>
  );
}

/* ─── Starred messages view ─────────────────────────────────── */

export function StarredMessagesScreen({
  state,
  onBack,
  communityName,
}: {
  state: DiscussionState;
  onBack: () => void;
  communityName: string;
}) {
  const [filter, setFilter] = useState<'all' | 'pinned'>('all');

  const starred = useMemo(
    () => state.messages.filter(m => state.starred.has(m.id) && (filter === 'all' || state.pinned.has(m.id))),
    [state.messages, state.starred, state.pinned, filter],
  );

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <div className="flex items-center gap-3 px-5 pt-3 pb-3" style={{ flexShrink: 0 }}>
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEV }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-black flex items-center gap-2" style={{ color: GOLD, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <StarIcon size={17} color={GOLD} filled /> Starred
          </h1>
          <p className="text-[11px]" style={{ color: TEXT3 }}>{communityName}</p>
        </div>
      </div>

      <div className="flex gap-1 px-5 pb-3" style={{ flexShrink: 0 }}>
        {(['all', 'pinned'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={filter === f ? { background: GOLD, color: BG } : { background: ELEV, color: TEXT2 }}
          >
            {f === 'all' ? 'All starred' : 'Starred + pinned'}
          </button>
        ))}
      </div>

      <div className="screen-body px-5">
        {starred.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>Nothing starred yet</p>
            <p className="text-xs" style={{ color: TEXT3 }}>Tap the star on any message to keep it here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            {starred.map(m => (
              <div key={m.id} className="rounded-2xl p-3.5" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar src={m.avatar} size={26} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: TEXT1 }}>{m.name}</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>{m.timestamp}</p>
                  </div>
                  {state.pinned.has(m.id) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,215,0,0.12)', color: GOLD }}>
                      <PinIcon size={9} color={GOLD} filled /> PINNED
                    </span>
                  )}
                  <button
                    onClick={() => state.toggleStar(m.id)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,215,0,0.12)' }}
                    aria-label="Unstar message"
                  >
                    <StarIcon size={14} color={GOLD} filled />
                  </button>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: TEXT2 }}>{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {state.toast && (
        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: 28 }}>
          <div className="px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in" style={{ background: CARD, color: TEXT1, border: `1px solid ${BORDER}` }}>
            {state.toast}
          </div>
        </div>
      )}

      <div className="px-5 py-3" style={{ flexShrink: 0 }}>
        <p className="text-[11px] text-center" style={{ color: TEXT3 }}>
          Starred messages are private to you · {state.starred.size} saved
        </p>
      </div>
      <div style={{ height: 8, flexShrink: 0, background: CYAN_DIM, opacity: 0 }} />
    </div>
  );
}
