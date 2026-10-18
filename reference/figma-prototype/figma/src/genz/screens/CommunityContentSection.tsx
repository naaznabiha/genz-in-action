import { useState } from 'react';
import { CloseIcon, ImageIcon, LinkIcon, CheckIcon } from '../components/Icons';
import { Button } from '../components/SharedUI';
import { CommunityContentItem, communityContent } from '../communityData';
import { PinIcon } from './CommunityDiscussion';

const BG = '#0B2239';
const CARD = '#11324D';
const ELEV = '#0D2A40';
const CYAN = '#00FFFF';
const GOLD = '#FFD700';
const RED = '#FF5555';
const GREEN = '#32CD32';
const TEXT1 = '#FFFFFF';
const TEXT2 = '#CDE2F0';
const TEXT3 = '#4A7A9B';
const BORDER = 'rgba(0,200,200,0.15)';

const FILTERS: { id: 'all' | CommunityContentItem['kind']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'guide', label: 'Guides' },
  { id: 'toolkit', label: 'Toolkits' },
  { id: 'video', label: 'Videos' },
  { id: 'deck', label: 'Decks' },
];

type UploadState = 'idle' | 'picked' | 'uploading' | 'error' | 'done';

/* ─── Composer / upload sheet ───────────────────────────────── */

function ContentComposer({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: (item: CommunityContentItem) => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<CommunityContentItem['kind']>('guide');
  const [upload, setUpload] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const runUpload = (fail = false) => {
    setUpload('uploading');
    setProgress(0);
    let p = 0;
    const timer = setInterval(() => {
      p += 12;
      setProgress(Math.min(p, 100));
      if (p >= (fail ? 60 : 100)) {
        clearInterval(timer);
        if (fail) {
          setUpload('error');
          setError('Upload failed — file is larger than 25 MB');
        } else {
          setUpload('done');
        }
      }
    }, 160);
  };

  const canPublish = title.trim().length >= 3 && upload === 'done';

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl animate-slide-up flex flex-col"
        style={{ background: CARD, border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ flexShrink: 0 }}>
          <div>
            <h3 className="text-lg font-black" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Add content</h3>
            <p className="text-xs" style={{ color: TEXT3 }}>Shared with every member of this community</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: ELEV }}>
            <CloseIcon size={15} color={TEXT2} />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto flex flex-col gap-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: TEXT2 }}>Content type</label>
            <div className="grid grid-cols-4 gap-2">
              {(['guide', 'toolkit', 'video', 'deck'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="py-2.5 rounded-xl text-[11px] font-bold capitalize transition-all"
                  style={kind === k
                    ? { background: 'rgba(0,255,255,0.12)', color: CYAN, border: `1px solid ${CYAN}55` }
                    : { background: ELEV, color: TEXT2, border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: TEXT2 }}>Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Energy Audit Toolkit v3"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: ELEV, color: TEXT1, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: TEXT2 }}>Short description</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="What is inside and who is it for?"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ background: ELEV, color: TEXT1, border: `1px solid ${BORDER}` }}
            />
          </div>

          {/* Upload states */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: TEXT2 }}>File</label>

            {upload === 'idle' && (
              <button
                onClick={() => { setUpload('picked'); }}
                className="w-full rounded-2xl py-8 flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: ELEV, border: `1.5px dashed ${CYAN}55` }}
              >
                <ImageIcon size={22} color={CYAN} />
                <p className="text-sm font-bold" style={{ color: TEXT1 }}>Choose a file</p>
                <p className="text-[11px]" style={{ color: TEXT3 }}>PDF, image, slides or video · up to 25 MB</p>
              </button>
            )}

            {upload === 'picked' && (
              <div className="rounded-2xl p-4" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,255,0.08)' }}>
                    <LinkIcon size={16} color={CYAN} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: TEXT1 }}>energy-audit-toolkit-v3.pdf</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>PDF · 4.6 MB · ready to upload</p>
                  </div>
                  <button onClick={() => setUpload('idle')} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,85,85,0.1)' }}>
                    <CloseIcon size={13} color={RED} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" fullWidth onClick={() => runUpload(false)}>Upload file</Button>
                  <Button size="sm" variant="secondary" onClick={() => runUpload(true)}>Simulate failure</Button>
                </div>
              </div>
            )}

            {upload === 'uploading' && (
              <div className="rounded-2xl p-4" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: TEXT1 }}>Uploading…</p>
                  <p className="text-xs font-bold" style={{ color: CYAN }}>{progress}%</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0A2233' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: `linear-gradient(90deg,#00BFBF,${CYAN})` }} />
                </div>
                <p className="text-[10px] mt-2" style={{ color: TEXT3 }}>energy-audit-toolkit-v3.pdf · do not close this sheet</p>
              </div>
            )}

            {upload === 'error' && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,85,85,0.07)', border: `1px solid ${RED}44` }}>
                <p className="text-xs font-bold mb-1" style={{ color: RED }}>Upload failed</p>
                <p className="text-[11px] mb-3" style={{ color: TEXT2 }}>{error}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => runUpload(false)}>Try again</Button>
                  <Button size="sm" variant="secondary" onClick={() => setUpload('idle')}>Choose another file</Button>
                </div>
              </div>
            )}

            {upload === 'done' && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(50,205,50,0.07)', border: `1px solid ${GREEN}44` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(50,205,50,0.12)' }}>
                  <CheckIcon size={16} color={GREEN} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: TEXT1 }}>energy-audit-toolkit-v3.pdf</p>
                  <p className="text-[10px]" style={{ color: GREEN }}>Uploaded · 4.6 MB</p>
                </div>
                <button onClick={() => setUpload('idle')} className="text-[11px] font-bold" style={{ color: TEXT3 }}>Replace</button>
              </div>
            )}
          </div>

          <Button
            fullWidth
            disabled={!canPublish}
            onClick={() =>
              onPublish({
                id: `ct${Date.now()}`,
                kind,
                title: title.trim(),
                meta: note.trim() || 'Just published',
                author: 'You',
                emoji: kind === 'video' ? '🎬' : kind === 'deck' ? '📊' : kind === 'toolkit' ? '🧰' : '📘',
                accent: CYAN,
              })
            }
          >
            Publish to community
          </Button>
          <p className="text-[10px] text-center pb-2" style={{ color: TEXT3 }}>
            Admins can pin published content to the top of this section.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Content section ───────────────────────────────────────── */

export function CommunityContentSection({
  canContribute,
  isAdmin,
  lockedNote,
}: {
  canContribute: boolean;
  isAdmin: boolean;
  lockedNote?: string;
}) {
  const [items, setItems] = useState<CommunityContentItem[]>(communityContent);
  const [filter, setFilter] = useState<'all' | CommunityContentItem['kind']>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1900); };

  const shown = items.filter(i => filter === 'all' || i.kind === filter);

  const togglePin = (id: string) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, pinned: !i.pinned } : i)));

  const ordered = [...shown].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  return (
    <div className="flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
      <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto" style={{ flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
            style={filter === f.id ? { background: CYAN, color: BG } : { background: ELEV, color: TEXT2 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="screen-body px-5">
        <div className="flex flex-col gap-2.5 pb-6">
          {ordered.map(item => (
            <div
              key={item.id}
              className="rounded-2xl p-3.5 flex items-start gap-3"
              style={{ background: CARD, border: item.pinned ? `1px solid ${GOLD}44` : '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: ELEV }}>
                {item.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,255,255,0.1)', color: item.accent }}>
                    {item.kind}
                  </span>
                  {item.pinned && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,215,0,0.12)', color: GOLD }}>
                      <PinIcon size={9} color={GOLD} filled /> PINNED
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold leading-snug" style={{ color: TEXT1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: TEXT3 }}>{item.meta} · by {item.author}</p>
                <div className="flex gap-2 mt-2.5">
                  <button className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,255,255,0.08)', color: CYAN }}>
                    Open
                  </button>
                  <button className="text-[11px] font-bold px-3 py-1.5 rounded-full" style={{ background: ELEV, color: TEXT2 }}>
                    Save
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { togglePin(item.id); flash(item.pinned ? 'Unpinned from Content' : 'Pinned to top of Content'); }}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(255,215,0,0.1)', color: GOLD }}
                    >
                      {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {ordered.length === 0 && (
            <div className="text-center py-14">
              <p className="text-4xl mb-3">📂</p>
              <p className="text-sm font-bold mb-1" style={{ color: TEXT1 }}>Nothing here yet</p>
              <p className="text-xs" style={{ color: TEXT3 }}>Be the first to share a resource with this community.</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-3" style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {canContribute ? (
          <Button fullWidth onClick={() => setComposerOpen(true)}>+ Add content</Button>
        ) : (
          <div className="rounded-2xl px-4 py-3 text-center" style={{ background: ELEV, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: TEXT2 }}>{lockedNote ?? 'Join this community to add content.'}</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="absolute left-0 right-0 flex justify-center z-50" style={{ bottom: 92 }}>
          <div className="px-4 py-2.5 rounded-full text-xs font-semibold animate-fade-in" style={{ background: CARD, color: TEXT1, border: `1px solid ${BORDER}` }}>
            {toast}
          </div>
        </div>
      )}

      {composerOpen && (
        <ContentComposer
          onClose={() => setComposerOpen(false)}
          onPublish={item => {
            setItems(prev => [item, ...prev]);
            setComposerOpen(false);
            flash('Content published to the community');
          }}
        />
      )}
    </div>
  );
}
