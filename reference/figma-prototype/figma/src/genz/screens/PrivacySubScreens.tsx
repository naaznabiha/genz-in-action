import { useState } from 'react';
import { Avatar, StatusBar, Button } from '../components/SharedUI';
import { CheckIcon, CloseIcon, ShieldIcon } from '../components/Icons';
import { blockedUsers as seedBlocked, followRequests as seedRequests } from '../communityData';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEV = '#0D2A40';
const CYAN = '#00FFFF';
const CYAN_DIM = '#00BFBF';
const GOLD = '#FFD700';
const RED = '#FF5555';
const GREEN = '#32CD32';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.13)';

function Header({ title, onBack, accent = CYAN, subtitle }: { title: string; onBack: () => void; accent?: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-3 pb-4" style={{ flexShrink: 0 }}>
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: ELEV }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke={TEXT1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div>
        <h1 className="text-xl font-black" style={{ color: accent, fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.03em' }}>{title}</h1>
        {subtitle && <p className="text-[11px]" style={{ color: TEXT3 }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="absolute left-0 right-0 flex justify-center z-50" style={{ bottom: 28 }}>
      <div className="px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in" style={{ background: CARD, color: TEXT1, border: `1px solid ${BORDER}` }}>
        {message}
      </div>
    </div>
  );
}

/* ─── Follow requests (private account) ─────────────────────── */

export function FollowRequestsScreen({ onBack }: { onBack: () => void }) {
  const [requests, setRequests] = useState(seedRequests);
  const [handled, setHandled] = useState<{ id: string; name: string; action: 'approved' | 'declined' }[]>([]);
  const [toast, setToast] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1900); };

  const resolve = (id: string, action: 'approved' | 'declined') => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    setRequests(prev => prev.filter(r => r.id !== id));
    setHandled(prev => [{ id, name: req.name, action }, ...prev]);
    flash(action === 'approved' ? `${req.name} can now follow you` : 'Request declined');
  };

  const undo = (id: string) => {
    const item = handled.find(h => h.id === id);
    const original = seedRequests.find(r => r.id === id);
    if (!item || !original) return;
    setHandled(prev => prev.filter(h => h.id !== id));
    setRequests(prev => [original, ...prev]);
    flash('Request restored');
  };

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <Header title="Follow Requests" onBack={onBack} subtitle="Private account · you approve every follower" />

      <div className="screen-body px-5">
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#0D2A40,#071828)', border: `1px solid ${BORDER}` }}>
          <div className="text-2xl">🔐</div>
          <div className="flex-1">
            <p className="text-xs font-bold mb-0.5" style={{ color: CYAN }}>{requests.length} waiting for review</p>
            <p className="text-[11px]" style={{ color: TEXT2 }}>Approved followers can see your posts, actions and impact points.</p>
          </div>
        </div>

        <div className="rounded-2xl px-4 py-3.5 mb-4 flex items-center gap-3" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: TEXT1 }}>Auto-approve mutuals</p>
            <p className="text-[11px]" style={{ color: TEXT3 }}>People you already follow skip the queue</p>
          </div>
          <button
            onClick={() => setAutoApprove(a => !a)}
            className="relative w-12 h-7 rounded-full transition-all flex-shrink-0"
            style={{ background: autoApprove ? CYAN_DIM : ELEV, border: autoApprove ? 'none' : '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all" style={{ left: autoApprove ? 26 : 2 }} />
          </button>
        </div>

        {requests.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>Pending</p>
            <div className="flex flex-col gap-2.5 mb-5">
              {requests.map(r => (
                <div key={r.id} className="rounded-2xl p-3.5" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start gap-3">
                    <Avatar src={r.avatar} size={42} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: TEXT1 }}>{r.name}</p>
                      <p className="text-[11px]" style={{ color: TEXT3 }}>
                        @{r.username} · {r.mutuals > 0 ? `${r.mutuals} mutual${r.mutuals > 1 ? 's' : ''}` : 'No mutuals'} · {r.timestamp}
                      </p>
                      {r.note && (
                        <p className="text-[11px] mt-2 rounded-xl px-3 py-2" style={{ background: ELEV, color: TEXT2 }}>“{r.note}”</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => resolve(r.id, 'approved')}
                          className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                          style={{ background: CYAN_DIM, color: '#FFFFFF' }}
                        >
                          <CheckIcon size={13} color="#FFFFFF" /> Approve
                        </button>
                        <button
                          onClick={() => resolve(r.id, 'declined')}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: ELEV, color: TEXT2, border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {requests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>All caught up</p>
            <p className="text-xs" style={{ color: TEXT3 }}>New follow requests will appear here.</p>
          </div>
        )}

        {handled.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>Recently handled</p>
            <div className="rounded-2xl overflow-hidden mb-6" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
              {handled.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: TEXT1 }}>{h.name}</p>
                    <p className="text-[10px]" style={{ color: h.action === 'approved' ? GREEN : TEXT3 }}>
                      {h.action === 'approved' ? 'Approved' : 'Declined'}
                    </p>
                  </div>
                  <button onClick={() => undo(h.id)} className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: ELEV, color: CYAN }}>
                    Undo
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}

/* ─── Blocked users management ──────────────────────────────── */

export function BlockedUsersScreen({ onBack }: { onBack: () => void }) {
  const [blocked, setBlocked] = useState(seedBlocked);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1900); };
  const target = blocked.find(b => b.id === confirm);

  const unblock = (id: string) => {
    const u = blocked.find(b => b.id === id);
    setBlocked(prev => prev.filter(b => b.id !== id));
    setConfirm(null);
    flash(u ? `${u.name} unblocked` : 'Unblocked');
  };

  return (
    <div className="screen" style={{ background: BG }}>
      <StatusBar />
      <Header title="Blocked Users" onBack={onBack} accent={GOLD} subtitle={`${blocked.length} blocked`} />

      <div className="screen-body px-5">
        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3" style={{ background: 'rgba(255,215,0,0.06)', border: `1px solid ${GOLD}33` }}>
          <ShieldIcon size={18} color={GOLD} />
          <p className="text-[11px] leading-relaxed" style={{ color: TEXT2 }}>
            Blocked people cannot follow you, message you, see your posts, or find your profile in search. They are not told they were blocked.
          </p>
        </div>

        {blocked.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">🛡️</p>
            <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>No one is blocked</p>
            <p className="text-xs" style={{ color: TEXT3 }}>Anyone you block from a profile or post appears here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-6">
            {blocked.map(b => (
              <div key={b.id} className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative">
                  <Avatar src={b.avatar} size={42} className="opacity-50" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#2D0F15', border: `1px solid ${RED}55` }}>
                    <CloseIcon size={10} color={RED} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: TEXT1 }}>{b.name}</p>
                  <p className="text-[11px]" style={{ color: TEXT3 }}>@{b.username} · blocked {b.blockedOn}</p>
                  <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,85,85,0.1)', color: RED }}>
                    {b.reason}
                  </span>
                </div>
                <button
                  onClick={() => setConfirm(b.id)}
                  className="text-[11px] font-bold px-3.5 py-2 rounded-full flex-shrink-0"
                  style={{ background: ELEV, color: TEXT1, border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {target && (
        <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setConfirm(null)}>
          <div className="w-full rounded-t-3xl p-6 animate-slide-up" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-3"><Avatar src={target.avatar} size={56} /></div>
            <h3 className="text-lg font-black text-center mb-1" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Unblock {target.name}?
            </h3>
            <p className="text-xs text-center mb-6" style={{ color: TEXT2 }}>
              They will be able to follow you, see your posts and message you again. You can block them again anytime.
            </p>
            <Button fullWidth onClick={() => unblock(target.id)}>Yes, unblock</Button>
            <button onClick={() => setConfirm(null)} className="w-full py-3.5 mt-2 rounded-xl text-sm font-semibold" style={{ background: ELEV, color: TEXT1 }}>
              Keep blocked
            </button>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
