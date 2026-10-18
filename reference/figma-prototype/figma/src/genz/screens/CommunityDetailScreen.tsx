import { useState } from 'react';
import { Avatar, StatusBar, Button, CategoryChip } from '../components/SharedUI';
import { CheckIcon, CloseIcon, LinkIcon, UsersIcon, CheckVerifiedIcon } from '../components/Icons';
import {
  Community,
  MembershipState,
  communityMembers,
  getCommunityById,
} from '../communityData';
import { DiscussionPanel, StarredMessagesScreen, useDiscussion } from './CommunityDiscussion';
import { CommunityContentSection } from './CommunityContentSection';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEV = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const GOLD = '#FFD700';
const GREEN = '#32CD32';
const PURPLE = '#A78BFA';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.15)';

const PRIVACY_META: Record<Community['privacy'], { icon: string; label: string; color: string; bg: string; note: string }> = {
  public: { icon: '🌐', label: 'Public', color: GREEN, bg: 'rgba(74,222,128,0.1)', note: 'Anyone can join and read posts' },
  private: { icon: '🔒', label: 'Private', color: CYAN, bg: 'rgba(0,255,255,0.1)', note: 'Admins approve every join request' },
  invite: { icon: '🛡️', label: 'Invite only', color: PURPLE, bg: 'rgba(167,139,250,0.12)', note: 'Members join through a direct invite' },
};

type Tab = 'about' | 'discussion' | 'content' | 'members';

function formatNum(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

/* ─── Invite sheet ──────────────────────────────────────────── */

function InviteSheet({ community, onClose }: { community: Community; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const link = `genzinaction.app/c/${community.id}?invite=8FQ2X`;

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl animate-slide-up flex flex-col"
        style={{ background: CARD, border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-lg font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Invite members</h3>
            <p className="text-xs" style={{ color: TEXT3 }}>{PRIVACY_META[community.privacy].note}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: ELEV }}>
            <CloseIcon size={15} color={TEXT2} />
          </button>
        </div>

        <div className="px-5 pb-6 overflow-y-auto">
          <div className="rounded-2xl p-4 mb-4" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>Invite link</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: '#0A2233' }}>
                <LinkIcon size={14} color={CYAN} />
                <p className="text-xs truncate" style={{ color: TEXT2 }}>{link}</p>
              </div>
              <button
                onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold flex-shrink-0"
                style={{ background: copied ? 'rgba(50,205,50,0.14)' : CYAN, color: copied ? GREEN : BG }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] mt-2" style={{ color: TEXT3 }}>Link expires in 7 days · resets when an admin regenerates it</p>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>Invite people you follow</p>
          <div className="flex flex-col gap-2">
            {communityMembers.slice(1, 6).map(m => {
              const sent = invited.has(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: ELEV }}>
                  <Avatar src={m.avatar} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{m.name}</p>
                    <p className="text-[11px]" style={{ color: TEXT3 }}>@{m.username}</p>
                  </div>
                  <button
                    onClick={() => setInvited(prev => new Set([...prev, m.id]))}
                    className="text-[11px] font-bold px-3.5 py-2 rounded-full"
                    style={sent
                      ? { background: 'rgba(50,205,50,0.12)', color: GREEN }
                      : { background: CYAN_DIM, color: '#FFFFFF' }}
                  >
                    {sent ? '✓ Invite sent' : 'Invite'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Membership action bar ─────────────────────────────────── */

function MembershipBar({
  state,
  community,
  onChange,
  onInvite,
  flash,
}: {
  state: MembershipState;
  community: Community;
  onChange: (s: MembershipState) => void;
  onInvite: () => void;
  flash: (m: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const join = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (community.privacy === 'public') {
        onChange('member');
        flash('You joined the community 🎉');
      } else {
        onChange('pending');
        flash('Request sent — an admin will review it');
      }
    }, 1100);
  };

  if (state === 'guest') {
    return (
      <div className="flex gap-2">
        <Button fullWidth loading={loading} onClick={join}>
          {community.privacy === 'public' ? 'Join community' : 'Request to join'}
        </Button>
        <Button variant="secondary" onClick={onInvite}>Share</Button>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div>
        <div className="rounded-2xl px-4 py-3 mb-2 flex items-center gap-3" style={{ background: 'rgba(255,215,0,0.07)', border: `1px solid ${GOLD}44` }}>
          <span className="text-lg">⏳</span>
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: GOLD }}>Request pending</p>
            <p className="text-[11px]" style={{ color: TEXT2 }}>Admins usually respond within a day. You can read the About tab meanwhile.</p>
          </div>
        </div>
        <Button variant="secondary" fullWidth onClick={() => { onChange('guest'); flash('Join request withdrawn'); }}>
          Withdraw request
        </Button>
      </div>
    );
  }

  if (state === 'invited') {
    return (
      <div>
        <div className="rounded-2xl px-4 py-3 mb-2 flex items-center gap-3" style={{ background: 'rgba(167,139,250,0.09)', border: `1px solid ${PURPLE}55` }}>
          <span className="text-lg">✉️</span>
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: PURPLE }}>You have been invited</p>
            <p className="text-[11px]" style={{ color: TEXT2 }}>
              {community.invitedBy ?? 'An admin'} invited you to join this invite-only community.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button fullWidth onClick={() => { onChange('member'); flash('Invite accepted — welcome in!'); }}>Accept invite</Button>
          <Button variant="secondary" onClick={() => { onChange('guest'); flash('Invite declined'); }}>Decline</Button>
        </div>
      </div>
    );
  }

  // member or admin
  return (
    <div className="flex gap-2">
      <Button variant="secondary" fullWidth onClick={onInvite}>+ Invite members</Button>
      <Button
        variant="secondary"
        onClick={() => { onChange('guest'); flash('You left the community'); }}
      >
        Leave
      </Button>
    </div>
  );
}

/* ─── Community detail screen ───────────────────────────────── */

export default function CommunityDetailScreen({
  communityId,
  onBack,
}: {
  communityId: string;
  onBack: () => void;
}) {
  const community = getCommunityById(communityId);
  const [membership, setMembership] = useState<MembershipState>(community.membership);
  const [tab, setTab] = useState<Tab>('about');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const [toast, setToast] = useState('');

  const isAdmin = membership === 'admin';
  const isMember = membership === 'member' || membership === 'admin';
  const discussion = useDiscussion(isAdmin);
  const privacy = PRIVACY_META[community.privacy];

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000); };

  const lockedNote =
    membership === 'pending'
      ? 'Your join request is still pending approval.'
      : membership === 'invited'
        ? 'Accept your invite to take part.'
        : community.privacy === 'public'
          ? 'Join this community to take part.'
          : 'Request access to take part.';

  if (starredOpen) {
    return <StarredMessagesScreen state={discussion} communityName={community.name} onBack={() => setStarredOpen(false)} />;
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'content', label: 'Content' },
    { id: 'members', label: 'Members' },
  ];

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />

      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-2 pb-2" style={{ flexShrink: 0 }}>
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEV }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: privacy.bg, color: privacy.color }}>
          {privacy.icon} {privacy.label}
        </span>
      </div>

      <div className="screen-body" style={tab === 'about' || tab === 'members' ? {} : { overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Banner + identity */}
        <div style={{ flexShrink: 0 }}>
          <div className="mx-5 rounded-3xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div className="h-24 w-full" style={{ background: 'linear-gradient(135deg,#005F5F 0%, #0B2239 100%)' }} />
            <div className="px-4 pb-4" style={{ background: CARD }}>
              <div className="-mt-8 mb-3 flex items-end justify-between">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-4" style={{ background: ELEV, borderColor: BG }}>
                  {community.emoji}
                </div>
                {membership === 'admin' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1" style={{ background: 'rgba(0,255,255,0.12)', color: CYAN }}>
                    You are an admin
                  </span>
                )}
                {membership === 'member' && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full mb-1 flex items-center gap-1" style={{ background: 'rgba(50,205,50,0.12)', color: GREEN }}>
                    <CheckIcon size={10} color={GREEN} /> Member
                  </span>
                )}
              </div>

              <h1 className="text-xl font-black leading-tight mb-0.5" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {community.name}
              </h1>
              <p className="text-xs mb-2.5" style={{ color: CYAN }}>{community.tagline}</p>

              <div className="flex items-center gap-4 mb-3">
                {[
                  { v: formatNum(community.members), l: 'members' },
                  { v: formatNum(community.posts), l: 'posts' },
                  { v: String(community.online), l: 'online' },
                ].map(s => (
                  <div key={s.l}>
                    <p className="text-sm font-black" style={{ color: TEXT1 }}>{s.v}</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>{s.l}</p>
                  </div>
                ))}
                <div className="ml-auto flex -space-x-2">
                  {communityMembers.slice(1, 5).map(m => (
                    <img key={m.id} src={m.avatar} alt="" className="w-7 h-7 rounded-full border-2 object-cover" style={{ borderColor: CARD }} />
                  ))}
                </div>
              </div>

              <MembershipBar
                state={membership}
                community={community}
                onChange={setMembership}
                onInvite={() => setInviteOpen(true)}
                flash={flash}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-3" style={{ flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
              style={tab === t.id ? { background: CYAN, color: BG } : { background: ELEV, color: TEXT2 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* About */}
        {tab === 'about' && (
          <div className="px-5 pb-8 flex flex-col gap-3 animate-fade-in">
            <div className="rounded-2xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>About</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: TEXT2 }}>{community.description}</p>
              <div className="flex flex-wrap gap-2">
                <CategoryChip category={community.category} small />
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ELEV, color: TEXT2 }}>📍 {community.location}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ELEV, color: TEXT2 }}>🗓 Since {community.createdOn}</span>
              </div>
            </div>

            <div className="rounded-2xl p-4" style={{ background: privacy.bg, border: `1px solid ${privacy.color}44` }}>
              <p className="text-xs font-bold mb-1" style={{ color: privacy.color }}>{privacy.icon} {privacy.label} community</p>
              <p className="text-[11px]" style={{ color: TEXT2 }}>{privacy.note}</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: TEXT3 }}>Community rules</p>
              <div className="flex flex-col gap-2.5">
                {community.rules.map((r, i) => (
                  <div key={r} className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0" style={{ background: ELEV, color: CYAN }}>{i + 1}</span>
                    <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>{r}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setTab('discussion')}
              className="rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{ background: 'linear-gradient(135deg, rgba(0,191,191,0.12), rgba(0,255,255,0.05))', border: `1px solid ${CYAN}33` }}
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style={{ background: 'rgba(0,255,255,0.1)' }}>💬</div>
              <div className="flex-1">
                <p className="text-sm font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Open discussion</p>
                <p className="text-[11px]" style={{ color: TEXT2 }}>{discussion.pinned.size} pinned · {discussion.messages.length} messages</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        {/* Members */}
        {tab === 'members' && (
          <div className="px-5 pb-8 flex flex-col gap-2 animate-fade-in">
            {!isMember && (
              <div className="rounded-2xl px-4 py-3 mb-1" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
                <p className="text-xs" style={{ color: TEXT2 }}>
                  {community.privacy === 'public'
                    ? 'Member list is public — join to message members.'
                    : 'Only approved members can see the full member list.'}
                </p>
              </div>
            )}
            {(isMember ? communityMembers : communityMembers.slice(0, 3)).map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
                <Avatar src={m.avatar} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate" style={{ color: TEXT1 }}>{m.name}</p>
                    {m.role === 'Admin' && <CheckVerifiedIcon size={13} color={CYAN} />}
                  </div>
                  <p className="text-[11px]" style={{ color: TEXT3 }}>@{m.username}</p>
                </div>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: m.role === 'Admin' ? 'rgba(0,255,255,0.12)' : m.role === 'Moderator' ? 'rgba(167,139,250,0.14)' : ELEV,
                    color: m.role === 'Admin' ? CYAN : m.role === 'Moderator' ? PURPLE : TEXT3,
                  }}
                >
                  {m.role.toUpperCase()}
                </span>
              </div>
            ))}
            {isAdmin && (
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-2 rounded-2xl py-3 flex items-center justify-center gap-2 text-xs font-bold"
                style={{ background: ELEV, color: CYAN, border: `1px dashed ${CYAN}55` }}
              >
                <UsersIcon size={14} color={CYAN} /> Invite more members
              </button>
            )}
          </div>
        )}

        {/* Discussion */}
        {tab === 'discussion' && (
          <DiscussionPanel
            state={discussion}
            canPost={isMember}
            lockedNote={lockedNote}
            onOpenStarred={() => setStarredOpen(true)}
          />
        )}

        {/* Content */}
        {tab === 'content' && (
          <CommunityContentSection canContribute={isMember} isAdmin={isAdmin} lockedNote={lockedNote} />
        )}
      </div>

      {toast && (
        <div className="absolute left-0 right-0 flex justify-center z-50" style={{ bottom: 28 }}>
          <div className="px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in" style={{ background: CARD, color: TEXT1, border: `1px solid ${BORDER}` }}>
            {toast}
          </div>
        </div>
      )}

      {inviteOpen && <InviteSheet community={community} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
