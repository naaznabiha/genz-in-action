import { useState } from 'react';
import { AppActions } from '../types';
import { posts, users, currentUser } from '../data';
import { Avatar, StatusBar, CategoryChip } from '../components/SharedUI';
import { CheckVerifiedIcon, SearchIcon, CalendarIcon, MapPinIcon } from '../components/Icons';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEVATED = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.13)';
const GREEN = '#32CD32';

function BackHeader({ title, onBack, accent = CYAN }: { title: string; onBack: () => void; accent?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-3 pb-4" style={{ flexShrink: 0 }}>
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEVATED }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="text-xl font-black" style={{ color: accent, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.04em' }}>
        {title}
      </h1>
    </div>
  );
}

function formatNum(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

/* ─── PROJECTS HUB ──────────────────────────────────────────── */
const projectPosts = posts.filter(p => p.type === 'action' || p.type === 'petition');

const projectExtras = [
  { id: 'px1', title: 'Urban Reforestation Initiative', lead: 'Maya Chen', members: 48, category: 'climate', progress: 72, status: 'Active', joined: false },
  { id: 'px2', title: 'Digital Literacy for Seniors', lead: 'Kai Johnson', members: 31, category: 'tech', progress: 45, status: 'Active', joined: true },
  { id: 'px3', title: 'Affordable Housing Coalition', lead: 'Priya Patel', members: 62, category: 'housing', progress: 58, status: 'Active', joined: false },
  { id: 'px4', title: 'Youth Mental Wellness Peer Network', lead: 'Sam Rivera', members: 87, category: 'mental-health', progress: 89, status: 'Recruiting', joined: false },
];

export function ProjectsHubScreen({ onBack, actions }: { onBack: () => void; actions: AppActions }) {
  const [joined, setJoined] = useState<Set<string>>(new Set(['px2']));
  const [tab, setTab] = useState<'active' | 'my'>('active');

  const toggle = (id: string) => setJoined(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <BackHeader title="Projects Hub" onBack={onBack} accent={CYAN} />

      {/* Tabs */}
      <div className="flex gap-1 px-5 mb-4" style={{ flexShrink: 0 }}>
        {(['active', 'my'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all"
            style={tab === t ? { background: CYAN, color: BG } : { background: ELEVATED, color: TEXT2 }}>
            {t === 'active' ? '🔥 Active Projects' : '⭐ My Projects'}
          </button>
        ))}
      </div>

      <div className="screen-body px-5">
        {/* Impact banner */}
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#0D2A40,#071828)', border: `1px solid ${BORDER}` }}>
          <div className="text-3xl">🚀</div>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: CYAN }}>Your Project Impact</p>
            <p className="text-sm" style={{ color: TEXT2 }}>You have joined <span style={{ color: TEXT1, fontWeight: 700 }}>{joined.size} projects</span> and contributed <span style={{ color: CYAN, fontWeight: 700 }}>+380 pts</span> this month.</p>
          </div>
        </div>

        {/* Project cards */}
        <div className="flex flex-col gap-3 pb-6">
          {projectExtras.filter(p => tab === 'active' || joined.has(p.id)).map(proj => (
            <div key={proj.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-3">
                  <p className="text-sm font-black leading-tight mb-1" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{proj.title}</p>
                  <p className="text-xs" style={{ color: TEXT3 }}>Led by <span style={{ color: TEXT2 }}>{proj.lead}</span> · {proj.members} members</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: proj.status === 'Recruiting' ? 'rgba(255,213,0,0.12)' : 'rgba(50,205,50,0.12)', color: proj.status === 'Recruiting' ? '#FFD700' : GREEN }}>
                  {proj.status}
                </span>
              </div>
              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: TEXT3 }}>Progress</span>
                  <span className="text-[10px] font-bold" style={{ color: CYAN }}>{proj.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: ELEVATED }}>
                  <div className="h-full rounded-full" style={{ width: `${proj.progress}%`, background: `linear-gradient(90deg, ${CYAN_DIM}, ${CYAN})` }} />
                </div>
              </div>
              <button
                onClick={() => toggle(proj.id)}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
                style={joined.has(proj.id)
                  ? { background: 'rgba(0,255,255,0.08)', color: CYAN, border: `1px solid ${CYAN}40` }
                  : { background: CYAN_DIM, color: BG }}>
                {joined.has(proj.id) ? '✓ Joined — Leave Project' : '+ Join Project'}
              </button>
            </div>
          ))}
          {tab === 'my' && joined.size === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>No projects yet</p>
              <p className="text-xs" style={{ color: TEXT3 }}>Join a project from the Active tab.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MEETINGS & EVENTS ──────────────────────────────────────── */
const meetings = [
  { id: 'm1', title: 'Climate Collective — Site Selection Meeting', date: '10/05/2026', time: '5:00 PM', host: 'Maya Chen', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=maya&backgroundColor=0B2239', attendees: ['Sam', 'Alex', 'Jordan'], extraCount: 4, link: '#', category: 'climate' },
  { id: 'm2', title: 'Tech & Innovation — Pitch Practice', date: '11/01/2026', time: '3:00 PM', host: 'Kai Johnson', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=kai&backgroundColor=0B2239', attendees: ['San K.', 'Chloo D.'], extraCount: 5, link: '#', category: 'tech' },
  { id: 'm3', title: 'Youth Mental Health App — Review & Demo', date: '11/03/2026', time: '1:00 PM', host: 'Sam Rivera', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=sam&backgroundColor=0B2239', attendees: ['Maria L.', 'Jean M.'], extraCount: 2, link: '#', category: 'mental-health' },
  { id: 'm4', title: 'Housing Rights Strategy Session', date: '11/08/2026', time: '6:30 PM', host: 'Priya Patel', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=priya&backgroundColor=0B2239', attendees: ['Luna', 'Tyler', 'River'], extraCount: 3, link: '#', category: 'housing' },
  { id: 'm5', title: 'Community Art Project — Kickoff', date: '11/12/2026', time: '4:00 PM', host: 'Zoe Martinez', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=zoe&backgroundColor=0B2239', attendees: ['Jamie', 'Alex'], extraCount: 6, link: '#', category: 'arts' },
];

export function MeetingsEventsScreen({ onBack }: { onBack: () => void }) {
  const [rsvp, setRsvp] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setRsvp(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <BackHeader title="Meetings & Events" onBack={onBack} accent="#FBBF24" />

      {/* Next up banner */}
      <div className="mx-5 mb-4 rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', flexShrink: 0 }}>
        <span className="text-2xl">📅</span>
        <div>
          <p className="text-xs font-semibold" style={{ color: '#FBBF24' }}>Next meeting in 3 days</p>
          <p className="text-sm font-bold" style={{ color: TEXT1 }}>Climate Collective — Oct 5 at 5:00 PM</p>
        </div>
      </div>

      <div className="screen-body px-5">
        <div className="flex flex-col gap-4 pb-6">
          {meetings.map(m => (
            <div key={m.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-black leading-snug flex-1 pr-2" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{m.title}</p>
                {/* @ts-ignore */}
                <CategoryChip category={m.category} small />
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: TEXT2 }}>
                  <CalendarIcon size={13} color={CYAN} />
                  {m.date}
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: TEXT2 }}>
                  🕐 {m.time}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Avatar src={m.avatar} size={20} />
                <span className="text-xs" style={{ color: TEXT3 }}>Hosted by <span style={{ color: TEXT2 }}>{m.host}</span></span>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="flex -space-x-1">
                  {m.attendees.slice(0, 3).map((name, i) => (
                    <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: ELEVATED, border: `1.5px solid ${CARD}`, color: CYAN, zIndex: 3 - i }}>
                      {name[0]}
                    </div>
                  ))}
                </div>
                <span className="text-xs" style={{ color: TEXT3 }}>
                  {m.attendees[0]}, {m.attendees[1]}{m.extraCount > 0 && ` and ${m.extraCount} others`}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggle(m.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={rsvp.has(m.id)
                    ? { background: 'rgba(0,255,255,0.08)', color: CYAN, border: `1px solid ${CYAN}40` }
                    : { background: CYAN_DIM, color: BG }}>
                  {rsvp.has(m.id) ? '✓ RSVP\'d' : 'Join Meeting Link'}
                </button>
                <button className="px-3 py-2.5 rounded-xl text-xs font-semibold" style={{ background: ELEVATED, color: TEXT2 }}>
                  📋 Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── RESOURCES LIBRARY ──────────────────────────────────────── */
const resources = [
  { id: 'r1', title: 'Community Organising 101', type: 'Guide', category: 'Fundamentals', emoji: '📖', reads: 3240, saved: false, desc: 'A complete starter guide to grassroots organizing — from canvassing to coalition building.' },
  { id: 'r2', title: 'How to Run a Petition Campaign', type: 'Toolkit', category: 'Advocacy', emoji: '✍️', reads: 2180, saved: true, desc: 'Step-by-step toolkit for launching, promoting, and delivering petitions that win.' },
  { id: 'r3', title: 'Social Media for Activists', type: 'Guide', category: 'Digital', emoji: '📱', reads: 5620, saved: false, desc: 'Platform-by-platform strategies for growing your cause and going viral for good.' },
  { id: 'r4', title: 'Grant Writing for Youth Orgs', type: 'Template', category: 'Funding', emoji: '💰', reads: 1890, saved: false, desc: 'Free grant proposal templates with annotated examples from funded Gen Z projects.' },
  { id: 'r5', title: 'Mental Health for Activists', type: 'Guide', category: 'Wellbeing', emoji: '💙', reads: 4120, saved: true, desc: 'Preventing burnout, setting boundaries, and sustaining your energy for the long fight.' },
  { id: 'r6', title: 'Know Your Legal Rights at Protests', type: 'Reference', category: 'Legal', emoji: '⚖️', reads: 6780, saved: false, desc: 'What police can and cannot do, your rights if detained, and emergency legal contacts.' },
  { id: 'r7', title: 'Climate Policy Explainer 2026', type: 'Report', category: 'Policy', emoji: '🌍', reads: 2940, saved: false, desc: 'Plain-English breakdown of current climate legislation and where you can push for change.' },
];

const resourceCategories = ['All', 'Fundamentals', 'Advocacy', 'Digital', 'Funding', 'Wellbeing', 'Legal', 'Policy'];
const typeColors: Record<string, string> = { Guide: CYAN, Toolkit: '#FBBF24', Template: '#A78BFA', Reference: '#FB923C', Report: '#4ADE80' };

export function ResourcesLibraryScreen({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState<Set<string>>(new Set(['r2', 'r5']));
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');

  const toggle = (id: string) => setSaved(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered = resources.filter(r =>
    (cat === 'All' || r.category === cat) &&
    (query === '' || r.title.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <BackHeader title="Resources Library" onBack={onBack} accent="#A78BFA" />

      {/* Search */}
      <div className="px-5 mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: ELEVATED, border: `1px solid ${BORDER}` }}>
          <SearchIcon size={16} color={TEXT3} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resources..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: TEXT1 }}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto" style={{ paddingBottom: 2, flexShrink: 0 }}>
        {resourceCategories.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={cat === c ? { background: '#A78BFA', color: BG } : { background: ELEVATED, color: TEXT2 }}>
            {c}
          </button>
        ))}
      </div>

      <div className="screen-body px-5">
        <div className="flex flex-col gap-3 pb-6">
          {filtered.map(r => (
            <div key={r.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: ELEVATED }}>
                  {r.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${typeColors[r.type] ?? CYAN}18`, color: typeColors[r.type] ?? CYAN }}>
                      {r.type}
                    </span>
                    <span className="text-[10px]" style={{ color: TEXT3 }}>{r.category}</span>
                  </div>
                  <p className="text-sm font-bold mb-1 leading-snug" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.title}</p>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: TEXT2 }}>{r.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: TEXT3 }}>👁 {formatNum(r.reads)} reads</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggle(r.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={saved.has(r.id) ? { background: 'rgba(0,255,255,0.1)', color: CYAN } : { background: ELEVATED, color: TEXT2 }}>
                        {saved.has(r.id) ? '🔖 Saved' : '+ Save'}
                      </button>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CYAN_DIM, color: BG }}>
                        Read →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-bold" style={{ color: TEXT1 }}>No resources found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MEMBER DIRECTORY ───────────────────────────────────────── */
const causes = ['All', 'Climate', 'Equality', 'Mental Health', 'Education', 'Housing', 'Community', 'Arts', 'Tech'];

export function MemberDirectoryScreen({ onBack, actions, followedUsers, onFollow }: {
  onBack: () => void;
  actions: AppActions;
  followedUsers: Set<string>;
  onFollow: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [cause, setCause] = useState('All');

  const allMembers = [currentUser, ...users];
  const filtered = allMembers.filter(u =>
    (cause === 'All' || u.cause.toLowerCase().includes(cause.toLowerCase())) &&
    (query === '' || u.displayName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <BackHeader title="Member Directory" onBack={onBack} accent="#4ADE80" />

      {/* Search */}
      <div className="px-5 mb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: ELEVATED, border: `1px solid ${BORDER}` }}>
          <SearchIcon size={16} color={TEXT3} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search members..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: TEXT1 }}
          />
        </div>
      </div>

      {/* Cause filter */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto" style={{ paddingBottom: 2, flexShrink: 0 }}>
        {causes.map(c => (
          <button key={c} onClick={() => setCause(c)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={cause === c ? { background: '#4ADE80', color: BG } : { background: ELEVATED, color: TEXT2 }}>
            {c}
          </button>
        ))}
      </div>

      <p className="px-5 mb-3 text-xs" style={{ color: TEXT3, flexShrink: 0 }}>{filtered.length} members</p>

      <div className="screen-body px-5">
        <div className="flex flex-col gap-3 pb-6">
          {filtered.map(u => {
            const isMe = u.id === 'me' || u.id === currentUser.id;
            const isFollowed = followedUsers.has(u.id);
            return (
              <div key={u.id} className="rounded-2xl p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => { onBack(); actions.onUserPress(u.id); }}>
                    <Avatar src={u.avatar} size={48} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <button onClick={() => { onBack(); actions.onUserPress(u.id); }}>
                        <span className="text-sm font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{u.displayName}</span>
                      </button>
                      {u.isVerified && <CheckVerifiedIcon size={13} />}
                      {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(0,255,255,0.12)', color: CYAN }}>You</span>}
                    </div>
                    <p className="text-xs mb-1" style={{ color: TEXT3 }}>@{u.username}</p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span style={{ color: TEXT2 }}><span style={{ color: TEXT1, fontWeight: 700 }}>{formatNum(u.followers)}</span> followers</span>
                      <span style={{ color: TEXT2 }}><span style={{ color: TEXT1, fontWeight: 700 }}>{u.actionsCount}</span> actions</span>
                    </div>
                  </div>
                  {!isMe && (
                    <button
                      onClick={() => onFollow(u.id)}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                      style={isFollowed
                        ? { background: 'rgba(0,255,255,0.08)', color: CYAN, border: `1px solid ${CYAN}40` }
                        : { background: CYAN_DIM, color: BG }}>
                      {isFollowed ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
                {u.cause && (
                  <div className="mt-2.5 pt-2.5 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ADE80' }}>
                      🎯 {u.cause}
                    </span>
                    {u.badges[0] && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: ELEVATED, color: TEXT2 }}>
                        {u.badges[0].emoji} {u.badges[0].name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
