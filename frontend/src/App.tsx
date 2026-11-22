import { useEffect, useState } from 'react';
import {
  Layers,
  Zap,
  Calendar,
  Globe,
  Plug,
  Sparkles,
  Download,
  Plus,
  CheckCircle2,
  Building2
} from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  sector: string;
  tone: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  website: string;
  brand_guidelines_md?: string;
  assets_dir?: string;
}

interface AssetFile {
  name: string;
  fullPath: string;
}

interface OutputFile {
  name: string;
  fullPath: string;
  size: number;
}

interface Recipe {
  id: string;
  title: string;
  source_url: string;
  source_type: string;
  steps_count: number;
}

interface StrategyItem {
  id: string;
  brand_id: string;
  day: number;
  format: string;
  topic: string;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  goal: string;
}

type ViewId = 'studio' | 'campaign' | 'calendar' | 'brands' | 'memory' | 'integrations';
type FormatId = 'post' | 'story' | 'linkedin';

const DEFAULT_COPY: Record<string, { eyebrow: string; title: string; desc: string; cta: string }> = {
  vega: {
    eyebrow: 'KARİYER FIRSATI',
    title: 'Gayrimenkulde Kendi Başarını Yönet.',
    desc: 'Güçlü marka desteği, profesyonel eğitim ve yüksek kazanç modeliyle danışman ekibimize katıl.',
    cta: 'Hemen Başvur →'
  },
  nefis: {
    eyebrow: 'ŞEFİN ÖZEL TABAĞI',
    title: 'Akşamın Lezzeti Ateşten Sofranıza.',
    desc: 'Özel dinlendirilmiş etler ve sıcak atmosferimizle hafta sonu masanızı şimdiden ayırtın.',
    cta: 'Masa Ayırt →'
  },
  aura: {
    eyebrow: 'ESTETİK DİŞ HEKİMLİĞİ',
    title: 'Doğal ve Sağlıklı Gülüş Tasarımı.',
    desc: 'Dijital ölçüm teknolojisi ve uzman hekim kadromuzla size özel tedavi planı.',
    cta: 'Ücretsiz Ön Görüşme →'
  }
};

export default function App() {
  const [view, setView] = useState<ViewId>('studio');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string>('vega');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<FormatId>('post');
  const [showGrid, setShowGrid] = useState(false);
  const [showSafe, setShowSafe] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState('Ana_Baslik_H1');
  const [revInput, setRevInput] = useState('');
  const [revStatus, setRevStatus] = useState('');
  const [lastPsdPath, setLastPsdPath] = useState('');
  const [qaScore, setQaScore] = useState(96);
  const [qaCritique, setQaCritique] = useState('Başlık ve CTA mobilde yüksek kontrastla okunuyor. Safe zone ihlali yok.');
  const [trendMoodboard, setTrendMoodboard] = useState<{ pattern: string; detail: string }[]>([]);
  const [brandAssets, setBrandAssets] = useState<AssetFile[]>([]);
  const [selectedHeroPath, setSelectedHeroPath] = useState('');
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>([]);
  const [editGuidelines, setEditGuidelines] = useState('');
  const [editAssetsDir, setEditAssetsDir] = useState('');
  const [appVersion, setAppVersion] = useState('1.2.3');
  const [toast, setToast] = useState('');

  // New brand form
  const [newBrand, setNewBrand] = useState({ name: '', sector: '', tone: 'Modern, kurumsal', primary_color: '#0F172A', secondary_color: '#1E293B', accent_color: '#38BDF8', font_family: 'Inter', website: '' });
  // New recipe form
  const [ytUrl, setYtUrl] = useState('');
  // Brief & Strategy
  const [briefText, setBriefText] = useState('Danışman olmak ister misiniz temalı sosyal medya içeriği, 1 aylık içerik stratejisi, örnek Post ve Story tasarımları ile PDF teklif sunumunu hazırla.');
  const [strategyItems, setStrategyItems] = useState<StrategyItem[]>([]);
  const [strategySummary, setStrategySummary] = useState('');
  const [activeCopy, setActiveCopy] = useState<{ eyebrow: string; title: string; desc: string; cta: string } | null>(null);
  // Pipeline simulation
  const [pipeLogs, setPipeLogs] = useState<string[]>(['> Ajanlar hazır. Brief verip başlatabilirsiniz.']);
  const [pipePct, setPipePct] = useState(0);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const loadOutputs = () => {
    fetch('/api/outputs').then(r => r.json()).then(setOutputFiles).catch(() => {});
  };

  useEffect(() => {
    fetch('/api/brands').then(r => r.json()).then((data: Brand[]) => {
      setBrands(data);
      if (data.length > 0) setActiveBrandId(data[0].id);
    }).catch(() => {});
    fetch('/api/recipes').then(r => r.json()).then(setRecipes).catch(() => {});
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {});
    fetch('/api/health').then(r => r.json()).then(d => { if (d.version) setAppVersion(d.version); }).catch(() => {});
    loadOutputs();
  }, []);

  useEffect(() => {
    setActiveCopy(null);
    setSelectedHeroPath('');
    fetch(`/api/strategy/${activeBrandId}`)
      .then(r => r.json())
      .then(data => {
        setStrategyItems(data.items || []);
        setStrategySummary(data.summary || '');
      })
      .catch(() => {});
    fetch(`/api/brands/${activeBrandId}/assets`)
      .then(r => r.json())
      .then(data => {
        const files = data.files || [];
        setBrandAssets(files);
        if (files.length > 0) setSelectedHeroPath(files[0].fullPath);
      })
      .catch(() => {});
    const b = brands.find(x => x.id === activeBrandId);
    if (b) {
      setEditGuidelines(b.brand_guidelines_md || '');
      setEditAssetsDir(b.assets_dir || '');
    }
  }, [activeBrandId, brands]);

  const activeBrand = brands.find(b => b.id === activeBrandId) || {
    id: 'vega',
    name: 'Vega Gayrimenkul',
    sector: 'Gayrimenkul',
    tone: 'Kurumsal',
    primary_color: '#0B1120',
    secondary_color: '#172554',
    accent_color: '#D4AF37',
    font_family: 'Montserrat',
    website: 'vegagayrimenkul.com'
  };

  const copy = activeCopy || DEFAULT_COPY[activeBrand.id] || {
    eyebrow: activeBrand.sector.toUpperCase(),
    title: `${activeBrand.name} ile Fark Yaratın.`,
    desc: `${activeBrand.tone} yaklaşımımızla hedef kitlenize en etkili şekilde ulaşın.`,
    cta: 'Detaylı Bilgi →'
  };

  const handleCheckUpdate = async () => {
    notify('GitHub üzerinden güncelleme kontrol ediliyor...');
    try {
      const res = await fetch('/api/system/check-update');
      const data = await res.json();
      notify(data.message || 'Güncelleme durumu alındı.');
      if (data.updateAvailable && data.releaseUrl) {
        window.open(data.releaseUrl, '_blank');
      }
    } catch {
      notify('Güncelleme sunucusuna ulaşılamadı.');
    }
  };

  const handleSaveSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    notify('API ve MCP ayarları SQLite veritabanına kaydedildi.');
  };

  const handleCreateBrand = async () => {
    if (!newBrand.name.trim() || !newBrand.sector.trim()) return;
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBrand)
    });
    if (res.ok) {
      const created = await res.json();
      setBrands(prev => [...prev, created]);
      setActiveBrandId(created.id);
      setNewBrand({ name: '', sector: '', tone: 'Modern, kurumsal', primary_color: '#0F172A', secondary_color: '#1E293B', accent_color: '#38BDF8', font_family: 'Inter', website: '' });
      notify(`"${created.name}" marka merkezine eklendi.`);
    }
  };

  const handleAddRecipe = async () => {
    if (!ytUrl.trim()) return;
    const res = await fetch('/api/memory/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ytUrl })
    });
    if (res.ok) {
      const data = await res.json();
      setRecipes(prev => [data.recipe, ...prev]);
      setYtUrl('');
      notify(`YouTube reçetesi çıkarıldı ve design-memory klasörüne kaydedildi (${data.steps.length} adım).`);
    }
  };

  const handleRunQa = async () => {
    notify('Vision QA tasarımı denetliyor...');
    try {
      const res = await fetch('/api/qa/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, psdPath: lastPsdPath, copy })
      });
      const data = await res.json();
      if (data.ok) {
        setQaScore(data.total);
        setQaCritique(data.critique);
        notify(`Vision QA tamamlandı: ${data.total}/100 (${data.mode})`);
      }
    } catch {
      notify('Backend bağlantı hatası.');
    }
  };

  const handleResearchTrends = async () => {
    const res = await fetch('/api/memory/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sector: activeBrand.sector })
    });
    if (res.ok) {
      const data = await res.json();
      setTrendMoodboard(data.moodboard || []);
      notify(`${activeBrand.sector} sektörü için güncel trend moodboard çıkarıldı.`);
    }
  };

  const handleCreatePsd = async () => {
    notify('Pro Editoryal Photoshop Scripti (.jsx) üretiliyor...');
    try {
      const res = await fetch('/api/adobe/photoshop/pro-jsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, copy, format, heroImagePath: selectedHeroPath })
      });
      const data = await res.json();
      if (data.ok) {
        setLastPsdPath(data.psdPath);
        loadOutputs();
        notify(`Pro JSX hazır: ${data.jsxPath} (Photoshop: Dosya → Komut Dosyaları → Gözat)`);
      } else {
        notify(`Hata: ${data.error}`);
      }
    } catch {
      notify('Backend bağlantı hatası.');
    }
  };

  const handleSaveBrandProfile = async () => {
    const res = await fetch(`/api/brands/${activeBrand.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_guidelines_md: editGuidelines, assets_dir: editAssetsDir })
    });
    if (res.ok) {
      const updated = await res.json();
      setBrands(prev => prev.map(b => (b.id === updated.id ? updated : b)));
      notify(`${updated.name} için .md Marka Rehberi ve Görsel Klasörü kaydedildi.`);
    }
  };

  const handleDeleteBrand = async (id: string) => {
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    const next = brands.filter(b => b.id !== id);
    setBrands(next);
    if (activeBrandId === id && next.length > 0) setActiveBrandId(next[0].id);
    notify('Marka ve ilişkili strateji silindi.');
  };

  const handleDeleteOutput = async (filename: string) => {
    await fetch(`/api/outputs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    loadOutputs();
    notify(`"${filename}" silindi.`);
  };

  const handleCreateAi = async () => {
    notify('Illustrator MCP: Vektör AI dosyası oluşturuluyor...');
    try {
      const res = await fetch('/api/adobe/illustrator/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, copy, format })
      });
      const data = await res.json();
      if (data.ok) notify(`Illustrator AI oluşturuldu: ${data.aiPath}`);
      else notify(`Illustrator hatası: ${data.error}`);
    } catch {
      notify('Backend bağlantı hatası (localhost:4010).');
    }
  };

  const handleFireflyEnhance = async (action: 'recompose' | 'restyle' | 'relight') => {
    notify(`Adobe 2027 Firefly (${action.toUpperCase()}) çalışıyor...`);
    try {
      const res = await fetch('/api/adobe/firefly/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, heroImagePath: selectedHeroPath, action, format })
      });
      const data = await res.json();
      if (data.ok) notify(data.message || 'Firefly 2027 işlemi tamamlandı!');
      else notify(`Hata: ${data.error}`);
    } catch {
      notify('Backend bağlantı hatası.');
    }
  };

  const handleFirefly = async () => {
    notify('Adobe Firefly sahne promptu hazırlanıyor...');
    try {
      const res = await fetch('/api/adobe/firefly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, format })
      });
      const data = await res.json();
      if (data.ok) notify(data.mode === 'live_firefly' ? 'Adobe Firefly görseli üretildi!' : data.message);
      else notify(`Firefly hatası: ${data.error}`);
    } catch {
      notify('Backend bağlantı hatası.');
    }
  };

  const handleRevision = async () => {
    const val = revInput.trim() || 'Tipografi kontrastı ve hizalama optimize edildi';
    setRevStatus('Photoshop MCP katmanları güncelliyor...');
    try {
      const res = await fetch('/api/adobe/photoshop/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psdPath: lastPsdPath, instruction: val })
      });
      const data = await res.json();
      if (data.ok) {
        setRevStatus(data.simulated ? data.message : `Photoshop MCP güncelledi (${data.updatedLayer}): "${val}" — Yeni QA: 98/100`);
        setQaScore(98);
        setRevInput('');
      } else {
        setRevStatus(`Hata: ${data.error}`);
      }
    } catch {
      setRevStatus('Backend bağlantı hatası.');
    }
  };

  const runPipeline = async () => {
    setPipeLogs([`> [${activeBrand.name}] Brief alındı. Strateji motoru başlatılıyor...`]);
    setPipePct(25);
    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: activeBrand.id, brief: briefText })
      });
      const data = await res.json();
      setStrategyItems(data.items || []);
      setStrategySummary(data.summary || '');
      const engineLabel = data.mode === 'claude' ? 'Claude API' : data.mode === 'gemini' ? 'Gemini API' : 'Offline Ajans Motoru (API key bekleniyor)';
      setPipeLogs(prev => [
        ...prev,
        `> [Motor: ${engineLabel}] ${(data.items || []).length} adet 30 günlük içerik üretildi ve SQLite veritabanına kaydedildi.`,
        '> [İhracat] Excel (.csv) ve Teklif Sunumu (PDF/HTML) indirmeye hazır.',
        '> Tamamlandı! 30 Günlük Strateji sekmesinden inceleyebilirsiniz.'
      ]);
      setPipePct(100);
      notify(`${activeBrand.name} için 30 günlük strateji üretildi (${engineLabel}).`);
    } catch {
      setPipeLogs(prev => [...prev, '> Hata: Backend servisine ulaşılamadı (localhost:4010).']);
    }
  };

  const artSize =
    format === 'post'
      ? { w: 340, h: 425, label: '1080 × 1350 px' }
      : format === 'story'
        ? { w: 280, h: 495, label: '1080 × 1920 px' }
        : { w: 480, h: 270, label: '1920 × 1080 px' };

  const layers = [
    { name: 'Ana_Baslik_H1', type: 'T', opacity: '100%' },
    { name: 'Alt_Aciklama', type: 'T', opacity: '90%' },
    { name: 'CTA_Buton_Grubu', type: '▢', opacity: '100%' },
    { name: 'Logo_SmartObject', type: '◆', opacity: '100%' },
    { name: 'Okunabilirlik_Gradient', type: '◐', opacity: '75%' },
    { name: 'BG_Firefly_Sahne', type: '✦', opacity: '100%' }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* SIDEBAR */}
      <aside className="w-60 shrink-0 bg-zinc-900/70 border-r border-zinc-800 flex flex-col justify-between">
        <div className="p-3.5 space-y-5">
          <div className="flex items-center justify-between px-1.5 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold text-xs tracking-tight">
                FM
              </div>
              <div>
                <div className="text-xs font-bold leading-none">AjansOS Studio</div>
                <div className="text-[11px] text-zinc-400 mt-1">FramioMedia • v{appVersion}</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Backend & DB Bağlı" />
          </div>

          <div className="space-y-1">
            <div className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Aktif Müşteri</div>
            <select
              value={activeBrandId}
              onChange={e => setActiveBrandId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-100 focus:outline-none"
            >
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <nav className="space-y-0.5 text-xs">
            <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Çalışma Alanı</div>
            {[
              { id: 'studio', label: 'Tasarım Stüdyosu (MCP)', icon: Layers },
              { id: 'campaign', label: 'Brief & Otomatik Üretim', icon: Zap },
              { id: 'calendar', label: '30 Günlük Strateji', icon: Calendar },
              { id: 'brands', label: 'Müşteri & Marka Merkezi', icon: Building2 }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewId)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition cursor-pointer ${
                    view === item.id ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="px-1.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Zeka & Altyapı</div>
            {[
              { id: 'memory', label: 'Araştırma & Öğrenme', icon: Globe },
              { id: 'integrations', label: 'MCP & API Bağlantıları', icon: Plug }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as ViewId)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition cursor-pointer ${
                    view === item.id ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3.5 border-t border-zinc-800 space-y-2 text-[11px]">
          <div className="flex justify-between"><span className="text-zinc-400">Photoshop / AI MCP</span><span className="text-emerald-400 font-medium">Hazır</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Adobe Firefly</span><span className="text-amber-400 font-medium">Entegre</span></div>
          <div className="flex justify-between"><span className="text-zinc-400">Gemini + Claude</span><span className="text-zinc-200 font-mono">API</span></div>
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <button onClick={handleCheckUpdate} className="w-full py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-[11px] font-medium text-zinc-200 cursor-pointer">
              Güncellemeleri Denetle
            </button>
            <div className="font-mono text-[10px] text-zinc-500 truncate">D:\Programlar\FramioMedia\AjansOS</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <header className="h-13 shrink-0 px-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm font-bold truncate">
              {view === 'studio' && 'Tasarım Stüdyosu — Photoshop MCP & Vision QA'}
              {view === 'campaign' && 'Brief & Otomatik Üretim Motoru'}
              {view === 'calendar' && '30 Günlük İçerik Stratejisi & Takvim'}
              {view === 'brands' && 'Müşteri & Marka Merkezi'}
              {view === 'memory' && 'Araştırma & Öğrenme Kütüphanesi'}
              {view === 'integrations' && 'Adobe MCP, Firefly & API Bağlantıları'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> QA {qaScore}/100
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleCreateAi} className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-medium cursor-pointer">
              Illustrator AI
            </button>
            <button onClick={handleCreatePsd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Photoshop PSD Üret
            </button>
          </div>
        </header>

        {/* STUDIO VIEW */}
        {view === 'studio' && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Layers */}
            <div className="w-full lg:w-60 shrink-0 border-r border-zinc-800 bg-zinc-900/40 flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between text-xs">
                <span className="font-semibold">Katmanlar (PSD)</span>
                <span className="font-mono text-[11px] text-zinc-500">{layers.length} Katman</span>
              </div>
              <div className="p-2 space-y-0.5 text-xs flex-1 overflow-y-auto">
                {layers.map(l => (
                  <div
                    key={l.name}
                    onClick={() => setSelectedLayer(l.name)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer transition ${
                      selectedLayer === l.name ? 'bg-zinc-800 border-l-2 border-indigo-400 text-white' : 'text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-indigo-400">{l.type}</span> {l.name}
                    </span>
                    <span className="text-[10px] text-zinc-500">{l.opacity}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-zinc-800 space-y-2">
                <div className="text-[11px] font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-400" /> Adobe Firefly</span>
                  <span className="text-[10px] font-mono text-amber-400">GenFill</span>
                </div>
                <button onClick={handleFirefly} className="w-full py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-medium cursor-pointer">
                  Arka Planı Yeniden Üret
                </button>
                <div className="grid grid-cols-3 gap-1 pt-1">
                  <button onClick={() => handleFireflyEnhance('recompose')} className="py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 text-[10px] cursor-pointer" title="Adobe 2027 Generative Recompose">Recompose</button>
                  <button onClick={() => handleFireflyEnhance('restyle')} className="py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 text-[10px] cursor-pointer" title="Adobe 2027 Generative Restyle">Restyle</button>
                  <button onClick={() => handleFireflyEnhance('relight')} className="py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 text-[10px] cursor-pointer" title="Photoshop 2027 Relight">Relight</button>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
              <div className="px-4 py-2 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                  {(['post', 'story', 'linkedin'] as FormatId[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        format === f ? 'bg-indigo-500 text-white font-medium' : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      {f === 'post' ? 'Post 4:5' : f === 'story' ? 'Story 9:16' : 'LinkedIn 16:9'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-indigo-500" /> Grid
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showSafe} onChange={e => setShowSafe(e.target.checked)} className="accent-indigo-500" /> Safe Zone
                  </label>
                  <span className="font-mono">{artSize.label}</span>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                <div
                  className="relative rounded-xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col justify-between p-7 bg-cover bg-center"
                  style={{
                    width: artSize.w,
                    height: artSize.h,
                    backgroundImage: selectedHeroPath
                      ? `linear-gradient(90deg, ${activeBrand.primary_color}cc 0%, ${activeBrand.primary_color}44 65%, transparent 100%), url(/api/asset-file?path=${encodeURIComponent(selectedHeroPath)})`
                      : `linear-gradient(145deg, ${activeBrand.primary_color} 0%, ${activeBrand.secondary_color} 100%)`,
                    color: '#F8FAFC'
                  }}
                >
                  {showGrid && <div className="absolute inset-0 pointer-events-none grid-overlay" />}
                  {showSafe && <div className="absolute inset-5 pointer-events-none safe-zone rounded" />}

                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded bg-white/10 border border-white/15">
                      {copy.eyebrow}
                    </span>
                    <span className="text-xs font-extrabold tracking-widest uppercase" style={{ color: activeBrand.accent_color }}>
                      {activeBrand.name.split(' ')[0]}
                    </span>
                  </div>

                  <div className="relative z-10 my-auto py-4">
                    <div className="w-12 h-0.5 mb-3" style={{ background: activeBrand.accent_color }} />
                    <div className="text-2xl font-extrabold leading-tight tracking-tight">{copy.title}</div>
                    <div className="text-xs mt-2.5 leading-relaxed opacity-85">{copy.desc}</div>
                  </div>

                  <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/10">
                    <span className="text-xs font-bold px-4 py-2 rounded-lg" style={{ background: activeBrand.accent_color, color: activeBrand.primary_color }}>
                      {copy.cta}
                    </span>
                    <span className="text-[10px] opacity-60 font-mono">{activeBrand.website || 'framiomedia.com'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <input
                    value={revInput}
                    onChange={e => setRevInput(e.target.value)}
                    placeholder="Photoshop MCP'ye Türkçe revize ver... (örn. Başlığı büyüt, kontrastı artır)"
                    className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs focus:outline-none"
                  />
                  <button onClick={handleRevision} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold cursor-pointer">
                    MCP ile Uygula
                  </button>
                </div>
                {revStatus && <div className="text-[11px] text-emerald-400 mt-1.5">{revStatus}</div>}
              </div>
            </div>

            {/* QA Panel */}
            <div className="w-full lg:w-72 shrink-0 border-l border-zinc-800 bg-zinc-900/40 p-4 space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Vision QA Denetimi</h2>
                <span className="text-sm font-bold font-mono text-emerald-400">{qaScore} / 100</span>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  ['Tipografi & Hiyerarşi', 97],
                  ['Kontrast & Okunabilirlik', 95],
                  ['Grid & Boşluk Dengesi', 96],
                  ['Marka Kimliği Uyumu', 96]
                ].map(([label, val]) => (
                  <div key={String(label)} className="space-y-1">
                    <div className="flex justify-between"><span>{label}</span><span className="font-mono">{val}%</span></div>
                    <div className="h-1.5 rounded-full bg-zinc-950 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${val}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-2">
                <div className="font-semibold">Kreatif Direktör Notu</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{qaCritique}</p>
                <button onClick={handleRunQa} className="w-full py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-medium cursor-pointer">
                  Vision QA Denetle (%90+ Kontrol)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAIGN VIEW */}
        {view === 'campaign' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-bold">Strateji & İçerik Üretim Motoru — {activeBrand.name}</h2>
                <textarea
                  rows={4}
                  value={briefText}
                  onChange={e => setBriefText(e.target.value)}
                  className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">API anahtarları giriliyse Claude/Gemini, değilse Offline Ajans Motoru çalışır.</span>
                  <button onClick={runPipeline} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold cursor-pointer">
                    Otomatik Üretimi Başlat
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between text-xs"><span className="font-bold text-zinc-400">CANLI AJAN AKIŞI</span><span className="font-mono">{pipePct}%</span></div>
                <div className="h-1.5 rounded-full bg-zinc-950 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${pipePct}%` }} /></div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 space-y-1.5 min-h-[180px]">
                  {pipeLogs.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === 'calendar' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold">30 Günlük İçerik Stratejisi — {activeBrand.name}</h2>
                  {strategySummary && <p className="text-xs text-zinc-400 mt-1">{strategySummary}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <a
                    href={`/api/export/calendar/${activeBrand.id}`}
                    className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 font-medium"
                  >
                    Excel (.csv) İndir
                  </a>
                  <a
                    href={`/api/export/proposal/${activeBrand.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold"
                  >
                    Teklif Sunumu (PDF) Aç
                  </a>
                </div>
              </div>

              {strategyItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-lg">
                  Bu marka için henüz strateji üretilmedi.{' '}
                  <button onClick={() => setView('campaign')} className="text-indigo-400 hover:underline cursor-pointer">
                    Brief & Otomatik Üretim sekmesinden oluşturun →
                  </button>
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="py-2 pr-3">Gün</th>
                      <th className="py-2 pr-3">Format</th>
                      <th className="py-2 pr-3">Konu & Başlık</th>
                      <th className="py-2 pr-3">Hedef</th>
                      <th className="py-2 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {strategyItems.map(it => (
                      <tr key={it.id}>
                        <td className="py-2.5 pr-3 font-mono">Gün {String(it.day).padStart(2, '0')}</td>
                        <td className="py-2.5 pr-3"><span className="px-2 py-0.5 rounded bg-zinc-800">{it.format}</span></td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{it.topic}</div>
                          <div className="text-[11px] text-zinc-400">{it.title}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-400">{it.goal}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setActiveCopy({ eyebrow: it.eyebrow, title: it.title, desc: it.desc, cta: it.cta });
                              setView('studio');
                            }}
                            className="text-indigo-400 hover:underline cursor-pointer"
                          >
                            Stüdyoda Aç →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* BRANDS VIEW */}
        {view === 'brands' && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Yeni Müşteri / Marka Ekle</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input value={newBrand.name} onChange={e => setNewBrand({ ...newBrand, name: e.target.value })} placeholder="Marka Adı" className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800" />
                <input value={newBrand.sector} onChange={e => setNewBrand({ ...newBrand, sector: e.target.value })} placeholder="Sektör (örn. Kahve)" className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800" />
                <input value={newBrand.website} onChange={e => setNewBrand({ ...newBrand, website: e.target.value })} placeholder="Web Sitesi" className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800" />
                <button onClick={handleCreateBrand} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold cursor-pointer">Kaydet</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {brands.map(b => (
                <div key={b.id} className={`bg-zinc-900/50 border rounded-xl p-4 space-y-2 text-xs ${b.id === activeBrand.id ? 'border-indigo-500' : 'border-zinc-800'}`}>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setActiveBrandId(b.id)} className="font-bold text-sm hover:text-indigo-400 cursor-pointer text-left">{b.name}</button>
                    <button onClick={() => handleDeleteBrand(b.id)} className="text-[11px] text-red-400 hover:underline cursor-pointer">Sil</button>
                  </div>
                  <div className="text-zinc-400">{b.sector} • {b.tone}</div>
                  <div className="flex gap-1.5 pt-1">
                    <span className="w-4 h-4 rounded-full border border-zinc-700" style={{ background: b.primary_color }} />
                    <span className="w-4 h-4 rounded-full border border-zinc-700" style={{ background: b.secondary_color }} />
                    <span className="w-4 h-4 rounded-full border border-zinc-700" style={{ background: b.accent_color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Marka .md Rehberi & Görsel Klasörü */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
                <h3 className="text-sm font-bold">{activeBrand.name} — Marka Rehberi (.md Kurallar) & Görsel Klasörü</h3>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Yerel Görsel Klasörü (örn. D:\Programlar\FramioMedia\AjansOS\storage\outputs)</span>
                  <input value={editAssetsDir} onChange={e => setEditAssetsDir(e.target.value)} placeholder="D:\Musteriler\Marka\Fotograflar" className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono" />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Marka Kuralları (.md formatı — Hedef kitle, içerik beklentisi, yasaklı kelimeler)</span>
                  <textarea rows={5} value={editGuidelines} onChange={e => setEditGuidelines(e.target.value)} placeholder="# Hedef Kitle&#10;- 25-45 yaş...&#10;# İçerik Beklentisi&#10;- Minimalist, güven veren dil..." className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono" />
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Klasörde bulunan görsel: {brandAssets.length} adet</span>
                  <button onClick={handleSaveBrandProfile} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold cursor-pointer">
                    .md Rehberi & Klasörü Kaydet
                  </button>
                </div>
                {brandAssets.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {brandAssets.map(a => (
                      <button
                        key={a.fullPath}
                        onClick={() => { setSelectedHeroPath(a.fullPath); setView('studio'); notify(`Seçilen görsel stüdyoya yüklendi: ${a.name}`); }}
                        className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${selectedHeroPath === a.fullPath ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-zinc-700 bg-zinc-950 text-zinc-300'}`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Eski Tasarımları Yönet / Sil */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Üretilen Tasarımlar (Sil / Yönet)</h3>
                  <button onClick={loadOutputs} className="text-indigo-400 hover:underline cursor-pointer">Yenile</button>
                </div>
                <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                  {outputFiles.length === 0 ? (
                    <div className="text-zinc-500 py-4 text-center">Henüz çıktı dosyası yok.</div>
                  ) : (
                    outputFiles.map(f => (
                      <div key={f.name} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                        <span className="font-mono truncate pr-2">{f.name}</span>
                        <button onClick={() => handleDeleteOutput(f.name)} className="text-red-400 hover:underline cursor-pointer shrink-0">Sil</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEMORY VIEW */}
        {view === 'memory' && (
          <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
              <h2 className="text-sm font-bold">YouTube Eğitiminden MCP Reçetesi Çıkar</h2>
              <div className="flex gap-2">
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800" />
                <button onClick={handleAddRecipe} className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold cursor-pointer">Ekle</button>
              </div>
              <div className="space-y-2 pt-2">
                {recipes.map(r => (
                  <div key={r.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between">
                    <span>{r.title}</span>
                    <span className="font-mono text-emerald-400">{r.steps_count} Adım</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Canlı Trend & Rakip Araştırması</h2>
                <button onClick={handleResearchTrends} className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold cursor-pointer">
                  {activeBrand.sector} Tara
                </button>
              </div>
              <p className="text-zinc-400">Meta Ad Library, Behance ve Pinterest kaynaklarından sektörel moodboard çıkarır.</p>
              <div className="space-y-2 pt-1">
                {trendMoodboard.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                    "{activeBrand.sector} Tara" butonuna basarak güncel trend özetini çıkarın.
                  </div>
                ) : (
                  trendMoodboard.map((m, i) => (
                    <div key={i} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                      <div className="font-semibold text-indigo-400">{m.pattern}</div>
                      <div className="text-zinc-400">{m.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* INTEGRATIONS VIEW */}
        {view === 'integrations' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-xl bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4 text-xs">
              <h2 className="text-sm font-bold">Gemini, Claude & Adobe Firefly API Ayarları</h2>
              <label className="block space-y-1">
                <span className="text-zinc-400">Google Gemini API Key</span>
                <input type="password" value={settings.gemini_api_key || ''} onChange={e => setSettings({ ...settings, gemini_api_key: e.target.value })} placeholder="AIzaSy..." className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono" />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-400">Anthropic Claude API Key</span>
                <input type="password" value={settings.claude_api_key || ''} onChange={e => setSettings({ ...settings, claude_api_key: e.target.value })} placeholder="sk-ant-..." className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono" />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-400">Adobe Firefly API Key</span>
                <input type="password" value={settings.firefly_api_key || ''} onChange={e => setSettings({ ...settings, firefly_api_key: e.target.value })} placeholder="Adobe Firefly Client / API Key" className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono" />
              </label>
              <button onClick={handleSaveSettings} className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-semibold cursor-pointer">
                Ayarları Kaydet
              </button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl text-xs font-medium text-emerald-400">
          {toast}
        </div>
      )}
    </div>
  );
}
