import React, { useState } from 'react'

const CATEGORIES_MP = ['All', 'Samples', 'Presets', 'MIDI Packs', 'Loop Kits', 'Sample Packs', 'Drum Kits', 'VST Presets']
const GENRES_MP = ['All', 'Trap', 'Hip-Hop', 'R&B', 'EDM', 'House', 'Techno', 'Pop', 'Cinematic', 'Lo-Fi']

const ITEMS = [
  { id: 'mp1', name: 'Trap God Kit Vol.1', author: 'BeatsByFire', category: 'Drum Kits', genre: 'Trap', price: 29.90, rating: 4.8, reviews: 234, downloads: 1820, image: '🥁', description: '50+ premium trap drum samples including 808s, snares, hi-hats', tags: ['808','trap','professional'], featured: true },
  { id: 'mp2', name: 'Lo-Fi Textures Pack', author: 'ChillVibes', category: 'Samples', genre: 'Lo-Fi', price: 19.90, rating: 4.9, reviews: 189, downloads: 2340, image: '🌊', description: 'Vintage lo-fi textures, vinyl crackle, dusty piano loops', tags: ['lofi','vintage','texture'], featured: true },
  { id: 'mp3', name: 'Serum EDM Presets', author: 'SynthMaster', category: 'VST Presets', genre: 'EDM', price: 39.90, rating: 4.7, reviews: 156, downloads: 987, image: '🎹', description: '100 professional Serum presets for EDM production', tags: ['serum','edm','synth'], featured: false },
  { id: 'mp4', name: 'R&B Chord Progressions', author: 'SoulProducer', category: 'MIDI Packs', genre: 'R&B', price: 14.90, rating: 4.6, reviews: 98, downloads: 756, image: '🎵', description: '50 MIDI chord progressions in R&B and soul style', tags: ['midi','rnb','chords'], featured: false },
  { id: 'mp5', name: 'Cinematic Strings Bundle', author: 'OrchestraWorks', category: 'Sample Packs', genre: 'Cinematic', price: 49.90, rating: 4.9, reviews: 312, downloads: 2100, image: '🎻', description: 'Full orchestral string ensemble recorded in 96kHz/24bit', tags: ['cinematic','strings','orchestra'], featured: true },
  { id: 'mp6', name: 'House Essentials Kit', author: 'DeepGroove', category: 'Loop Kits', genre: 'House', price: 24.90, rating: 4.5, reviews: 145, downloads: 1230, image: '🎧', description: '100 house music loops: bass, leads, chords, percussion', tags: ['house','loops','essential'], featured: false },
  { id: 'mp7', name: 'Minimal Techno Samples', author: 'BerlinSounds', category: 'Samples', genre: 'Techno', price: 34.90, rating: 4.7, reviews: 89, downloads: 670, image: '⚙️', description: 'Gritty techno drums, acid bass, industrial textures', tags: ['techno','minimal','industrial'], featured: false },
  { id: 'mp8', name: 'Pop Vocal Chops Vol.2', author: 'VocalStudio', category: 'Sample Packs', genre: 'Pop', price: 22.90, rating: 4.8, reviews: 267, downloads: 1890, image: '🎤', description: 'Royalty-free vocal chops, hooks and ad-libs', tags: ['vocals','pop','chops'], featured: true },
  { id: 'mp9', name: 'FREE Starter Pack', author: 'MusicCreator', category: 'Drum Kits', genre: 'All', price: 0, rating: 4.6, reviews: 1234, downloads: 8900, image: '🎁', description: 'Free starter pack with 30 essential samples for beginners', tags: ['free','starter','beginner'], featured: true },
  { id: 'mp10', name: 'Hip-Hop Essentials Vol.3', author: 'GoldChain', category: 'Loop Kits', genre: 'Hip-Hop', price: 27.90, rating: 4.7, reviews: 203, downloads: 1450, image: '🎵', description: 'Authentic hip-hop samples: boom bap drums, vinyl scratches', tags: ['hiphop','boomba','authentic'], featured: false },
  { id: 'mp11', name: 'Massive X Bass Presets', author: 'SubFrequency', category: 'VST Presets', genre: 'Trap', price: 18.90, rating: 4.4, reviews: 76, downloads: 520, image: '🔊', description: '50 deep 808 and sub bass presets for Massive X', tags: ['808','bass','massive'], featured: false },
  { id: 'mp12', name: 'Jazz Chord MIDI Pack', author: 'JazzCat', category: 'MIDI Packs', genre: 'R&B', price: 16.90, rating: 4.9, reviews: 134, downloads: 890, image: '🎷', description: 'Complex jazz chords, voicings and progressions in MIDI format', tags: ['jazz','chords','midi'], featured: false },
]

function Stars({ rating }) {
  return (
    <span style={{ fontSize: 11, color: '#f59e0b' }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

function ItemCard({ item, purchased, onAction, onPreview }) {
  const isFree = item.price === 0
  const color = purchased ? '#22c55e' : isFree ? '#22c55e' : '#3b82f6'
  return (
    <div style={{ background: '#111', border: `1px solid ${item.featured ? '#3b82f622' : '#1a1a1a'}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f644'}
      onMouseLeave={e => e.currentTarget.style.borderColor = item.featured ? '#3b82f622' : '#1a1a1a'}>
      <div style={{ height: 90, background: 'linear-gradient(135deg,#1a1a2e,#0f0f1e)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 42 }}>{item.image}</span>
        {item.featured && <div style={{ position: 'absolute', top: 6, left: 6, background: '#f59e0b', color: '#000', padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 800 }}>FEATURED</div>}
        {isFree && <div style={{ position: 'absolute', top: 6, right: 6, background: '#22c55e', color: '#000', padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 800 }}>FREE</div>}
        {purchased && !isFree && <div style={{ position: 'absolute', top: 6, right: 6, background: '#3b82f6', color: '#fff', padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700 }}>✓ OWNED</div>}
        <button onClick={() => onPreview(item)} style={{ position: 'absolute', bottom: 6, right: 6, width: 24, height: 24, background: '#ffffff22', border: '1px solid #ffffff33', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: 10 }}>▶</button>
      </div>
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 8, color: '#3b82f6', background: '#1e3a5f', padding: '1px 5px', borderRadius: 3 }}>{item.category}</span>
          <span style={{ fontSize: 8, color: '#555', background: '#1a1a1a', padding: '1px 5px', borderRadius: 3 }}>{item.genre}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#ddd', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 10, color: '#555' }}>by {item.author}</div>
        <div style={{ fontSize: 11, color: '#666', flex: 1, lineHeight: 1.4 }}>{item.description}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Stars rating={item.rating} />
          <span style={{ fontSize: 9, color: '#555' }}>{item.rating} ({item.reviews})</span>
          <span style={{ fontSize: 9, color: '#333', marginLeft: 'auto' }}>↓{item.downloads.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: isFree ? '#22c55e' : '#fff' }}>
            {isFree ? 'FREE' : `R$ ${item.price.toFixed(2)}`}
          </span>
          <button onClick={() => onAction(item)} style={{ flex: 1, padding: '6px', background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 7, color, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            {purchased ? '↓ Download' : isFree ? '↓ Get Free' : '🛒 Buy'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Marketplace() {
  const [category, setCategory] = useState('All')
  const [genre, setGenre] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('featured')
  const [priceFilter, setPriceFilter] = useState('all')
  const [purchased, setPurchased] = useState(new Set(['mp9']))
  const [cart, setCart] = useState([])
  const [tab, setTab] = useState('browse')
  const [previewItem, setPreviewItem] = useState(null)

  const filtered = ITEMS.filter(item => {
    if (category !== 'All' && item.category !== category) return false
    if (genre !== 'All' && item.genre !== genre && item.genre !== 'All') return false
    if (priceFilter === 'free' && item.price > 0) return false
    if (priceFilter === 'paid' && item.price === 0) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.author.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating
    if (sortBy === 'price') return a.price - b.price
    if (sortBy === 'downloads') return b.downloads - a.downloads
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return 0
  })

  const handleAction = (item) => {
    if (item.price === 0 || purchased.has(item.id)) {
      setPurchased(prev => new Set([...prev, item.id]))
      alert(`✓ ${item.name} downloaded! (demo)`)
    } else {
      if (!cart.includes(item.id)) setCart(prev => [...prev, item.id])
    }
  }

  const cartTotal = cart.reduce((s, id) => s + (ITEMS.find(i => i.id === id)?.price || 0), 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>MARKETPLACE</span>
        <div style={{ width: 1, height: 20, background: '#333' }} />
        {[['browse','🛍️ Browse'], ['myitems','📦 My Items'], ['sell','⬆️ Sell']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '5px 12px', background: tab === t ? '#1e3a5f' : 'transparent', border: `1px solid ${tab === t ? '#3b82f6' : '#333'}`, borderRadius: 8, color: tab === t ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 12 }}>
            {label}
          </button>
        ))}
        {cart.length > 0 && (
          <button onClick={() => { cart.forEach(id => setPurchased(prev => new Set([...prev, id]))); setCart([]) }}
            style={{ marginLeft: 'auto', padding: '5px 14px', background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 8, color: '#3b82f6', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            🛒 Checkout ({cart.length}) — R$ {cartTotal.toFixed(2)}
          </button>
        )}
      </div>

      {tab === 'browse' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: 150, flexShrink: 0, background: '#0e0e0e', borderRight: '1px solid #1a1a1a', overflowY: 'auto', fontSize: 12 }}>
            {[['Category', CATEGORIES_MP, category, setCategory], ['Genre', GENRES_MP, genre, setGenre]].map(([title, list, val, setter]) => (
              <div key={title}>
                <div style={{ padding: '8px 10px', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
                {list.map(item => (
                  <button key={item} onClick={() => setter(item)}
                    style={{ width: '100%', padding: '5px 12px', background: val === item ? '#1e3a5f' : 'transparent', border: 'none', borderLeft: `3px solid ${val === item ? '#3b82f6' : 'transparent'}`, color: val === item ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
                    {item}
                  </button>
                ))}
              </div>
            ))}
            <div style={{ padding: '8px 10px', fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, borderTop: '1px solid #1a1a1a', marginTop: 4 }}>Price</div>
            {[['all','All'],['free','Free'],['paid','Paid']].map(([v, label]) => (
              <button key={v} onClick={() => setPriceFilter(v)}
                style={{ width: '100%', padding: '5px 12px', background: priceFilter === v ? '#1e3a5f' : 'transparent', border: 'none', borderLeft: `3px solid ${priceFilter === v ? '#3b82f6' : 'transparent'}`, color: priceFilter === v ? '#3b82f6' : '#666', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#0d0d0d', borderBottom: '1px solid #141414', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 13, outline: 'none' }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}>
                <option value="featured">Featured</option>
                <option value="rating">Best Rated</option>
                <option value="downloads">Most Downloaded</option>
                <option value="price">Lowest Price</option>
              </select>
              <span style={{ fontSize: 11, color: '#555' }}>{filtered.length} items</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 10 }}>
                {filtered.map(item => (
                  <ItemCard key={item.id} item={item} purchased={purchased.has(item.id)} onAction={handleAction} onPreview={setPreviewItem} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'myitems' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <h3 style={{ marginTop: 0, color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>My Purchases ({purchased.size})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 10 }}>
            {[...purchased].map(id => {
              const item = ITEMS.find(i => i.id === id)
              return item ? <ItemCard key={id} item={item} purchased onAction={handleAction} onPreview={setPreviewItem} /> : null
            })}
          </div>
          {purchased.size === 0 && <div style={{ color: '#444', fontSize: 14, textAlign: 'center', padding: 40 }}>No purchases yet.</div>}
        </div>
      )}

      {tab === 'sell' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 600, width: '100%', alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: '0 0 4px', color: '#ddd' }}>Sell Your Samples & Presets</h3>
          <p style={{ fontSize: 12, color: '#555', margin: 0 }}>Reach thousands of producers. You keep 70% of every sale.</p>
          {[['Product Name','text'],['Artist / Label Name','text'],['Price (R$)','number'],['Short Description','textarea']].map(([label, type]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
              {type === 'textarea'
                ? <textarea rows={3} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', borderRadius: 6, padding: '8px 10px', fontSize: 13, resize: 'vertical', outline: 'none' }} />
                : <input type={type} style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' }} />
              }
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            {['ZIP File', 'Audio Preview', 'Cover Image'].map(f => (
              <div key={f} style={{ flex: 1, height: 64, background: '#0d0d0d', border: '2px dashed #222', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: '#444' }}>
                📁 {f}
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', background: '#0d1a0d', border: '1px solid #22c55e22', borderRadius: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
            💰 Revenue split: 70% yours / 30% platform<br/>
            💳 Payouts via PIX or bank transfer<br/>
            ✅ Manual review within 48h after submission
          </div>
          <button style={{ padding: '12px', background: 'linear-gradient(135deg,#1e3a5f,#0f2040)', border: '1px solid #3b82f6', borderRadius: 10, color: '#60a5fa', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            🚀 Submit for Review
          </button>
        </div>
      )}

      {previewItem && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setPreviewItem(null)}>
          <div style={{ background: '#111', border: '1px solid #3b82f6', borderRadius: 16, padding: '24px', width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 36 }}>{previewItem.image}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#ddd' }}>{previewItem.name}</div>
                <div style={{ fontSize: 11, color: '#555' }}>by {previewItem.author}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#777', marginBottom: 14 }}>{previewItem.description}</div>
            <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '10px', marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: '#444', marginBottom: 6 }}>PREVIEW WAVEFORM</div>
              <div style={{ display: 'flex', gap: 1, height: 36, alignItems: 'center' }}>
                {Array.from({length:48}, () => <div key={Math.random()} style={{ flex:1, height:`${Math.random()*80+10}%`, background:'#3b82f6', borderRadius:1, opacity:0.7 }} />)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { handleAction?.(previewItem); setPreviewItem(null) }}
                style={{ flex:1, padding:'9px', background:'#1e3a5f', border:'1px solid #3b82f6', borderRadius:8, color:'#3b82f6', cursor:'pointer', fontSize:13, fontWeight:700 }}>
                {previewItem.price === 0 ? 'Get Free' : `Buy — R$ ${previewItem.price.toFixed(2)}`}
              </button>
              <button onClick={() => setPreviewItem(null)} style={{ padding:'9px 14px', background:'transparent', border:'1px solid #333', borderRadius:8, color:'#666', cursor:'pointer', fontSize:13 }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
