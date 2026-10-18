import { useState } from 'react';
import { StatusBar } from '../components/SharedUI';
import { SearchIcon } from '../components/Icons';
import { Community, communities } from '../communityData';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEV = '#0D2A40';
const CYAN = '#00FFFF';
const GOLD = '#FFD700';
const GREEN = '#32CD32';
const PURPLE = '#A78BFA';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.13)';

const PRIVACY: Record<Community['privacy'], { icon: string; label: string; color: string; bg: string }> = {
  public: { icon: '🌐', label: 'Public', color: GREEN, bg: 'rgba(74,222,128,0.1)' },
  private: { icon: '🔒', label: 'Private', color: CYAN, bg: 'rgba(0,255,255,0.1)' },
  invite: { icon: '🛡️', label: 'Invite only', color: PURPLE, bg: 'rgba(167,139,250,0.12)' },
};

const STATE_CHIP: Record<Community['membership'], { label: string; color: string; bg: string } | null> = {
  guest: null,
  pending: { label: '⏳ Request pending', color: GOLD, bg: 'rgba(255,215,0,0.1)' },
  invited: { label: '✉️ Invite waiting', color: PURPLE, bg: 'rgba(167,139,250,0.12)' },
  member: { label: '✓ Member', color: GREEN, bg: 'rgba(50,205,50,0.12)' },
  admin: { label: '★ Admin', color: CYAN, bg: 'rgba(0,255,255,0.12)' },
};

function formatNum(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

export default function CommunitiesScreen({
  onBack,
  onOpenCommunity,
  onCreate,
}: {
  onBack: () => void;
  onOpenCommunity: (id: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');

  const list = communities.filter(c => {
    const matches = c.name.toLowerCase().includes(query.toLowerCase()) || c.tagline.toLowerCase().includes(query.toLowerCase());
    const mine = c.membership === 'member' || c.membership === 'admin';
    return matches && (tab === 'discover' || mine);
  });

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />

      <div className="flex items-center gap-3 px-5 pt-3 pb-3" style={{ flexShrink: 0 }}>
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEV }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-xl font-black" style={{ color: CYAN, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.04em' }}>
          Communities
        </h1>
      </div>

      <div className="px-5 pb-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
          <SearchIcon size={16} color={TEXT3} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search communities"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: TEXT1 }}
          />
        </div>
      </div>

      <div className="flex gap-1 px-5 pb-3" style={{ flexShrink: 0 }}>
        {(['discover', 'mine'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={tab === t ? { background: CYAN, color: BG } : { background: ELEV, color: TEXT2 }}
          >
            {t === 'discover' ? '🔎 Discover' : '🏠 My Communities'}
          </button>
        ))}
      </div>

      <div className="screen-body px-5">
        <button
          onClick={onCreate}
          className="w-full flex items-center gap-4 rounded-2xl p-4 mb-3 text-left transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(0,191,191,0.12) 0%, rgba(0,255,255,0.06) 100%)', border: '1px solid rgba(0,255,255,0.22)' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(0,255,255,0.1)' }}>🏘️</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black mb-0.5" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create a community</p>
            <p className="text-xs" style={{ color: TEXT2 }}>Name it, pick a privacy level, invite your people</p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <div className="flex flex-col gap-3 pb-6">
          {list.map(c => {
            const p = PRIVACY[c.privacy];
            const chip = STATE_CHIP[c.membership];
            return (
              <button
                key={c.id}
                onClick={() => onOpenCommunity(c.id)}
                className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: ELEV }}>{c.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: p.bg, color: p.color }}>{p.icon} {p.label}</span>
                      {chip && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: chip.bg, color: chip.color }}>{chip.label}</span>}
                    </div>
                    <p className="text-sm font-black leading-tight" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{c.name}</p>
                    <p className="text-[11px] mb-1.5" style={{ color: CYAN }}>{c.tagline}</p>
                    <p className="text-[11px]" style={{ color: TEXT3 }}>
                      {formatNum(c.members)} members · {formatNum(c.posts)} posts · {c.online} online
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {list.length === 0 && (
            <div className="text-center py-14">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>No communities found</p>
              <p className="text-xs" style={{ color: TEXT3 }}>Try another search, or start your own.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
