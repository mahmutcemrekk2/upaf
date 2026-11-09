# UPAF — Durum Analizi ve Yol Planı

_Son güncelleme: 2026-11-09_

## 1. Proje nedir?

**UPAF (Universal Playwright AI Framework)**, bir "Test Automation as a Service" platformu. Kullanıcı testlerini web arayüzünde görsel olarak tasarlıyor (UI ve API adımları). Platform bu tasarımları **Playwright + TypeScript (POM)** koduna çevirip müşterinin GitHub/GitLab reposuna `tests/upaf-generated/` klasörü altında push'luyor.

Temel ilke: UPAF bir **kod üreticisi**, bulutta test koşturan bir servis değil. Testler müşterinin kendi CI/CD hattında çalışıyor.

| Paket | Teknoloji | Görev |
|---|---|---|
| `dashboard/` | React 19 + Vite 8 + Tailwind + Framer Motion | Landing, Auth, Proje listesi, 3 sütunlu Test Builder IDE |
| `dashboard/auth-proxy.js` | Express (port 5175) | CORS proxy, step-definition tarayıcı, **yeni:** canlı Recorder + UI Runner (Playwright) |
| `dashboard/vite.config.js` | Vite middleware | Dev modda aynı proxy/step-definitions uçları (auth-proxy ile kod tekrarı var) |
| `generator/` | TypeScript | JSON `TestSuite` → `.spec.ts` + POM sınıfları + `playwright.config.ts` |
| Supabase | Auth + DB | `profiles`, `projects`, `test_cases`, `test_steps` tabloları |
| Vercel | Hosting | Sadece dashboard'un statik build'i (`vercel.json`) |

## 2. Zaman çizelgesi (git + dosya tarihleri)

| Tarih | Olay |
|---|---|
| Mayıs 2026 | `PROJECT_CONTEXT*.md` yazıldı. Faz 1–3 tamamlandı olarak işaretli. |
| 2 Ağu 2026 17:48 | `cdf6773` Initial commit (Vercel deploy için ~13k satır tek seferde) |
| 2 Ağu 2026 17:55 | `2e5c0eb` `vercel.json` eklendi |
| 2 Ağu 2026 17:57 | `97de337` Siyah ekran düzeltmesi (env fallback, güvenli auth init). **Push'lanan son commit** |
| 2 Ağu 23:00 → 3 Ağu | **Commit'lenmemiş:** Test Recorder modal, UI Runner, headless toggle, screenshot zoom modal, StepCard düzeni |
| 27 Ağu 2026 | `auth-proxy.js` üzerinde son dokunuş (runner/self-healing fallback'leri) |
| 27 Ağu → bugün | Proje durgun (~2,5 ay) |

`main` ile `origin/main` eşit durumda; yani commit'lenmiş ama push'lanmamış bir şey yok. Bekleyen her şey **working tree'de, hiç commit'lenmemiş halde**.

## 3. Commit'lenmemiş iş: "Canlı Recorder + UI Runner" özelliği

Bu iş Faz 5'in ("Zeka") başlangıcı sayılabilir. +1117 / −59 satır:

| Dosya | Değişiklik |
|---|---|
| `dashboard/auth-proxy.js` (+732) | `POST /api/recorder/start`: headful Chromium açıyor, sayfaya kayıt widget'ı enjekte ediyor (click/fill/select yakalama, "✨ Validasyon Ekle" ile text/visible assertion). Akıllı selector üretimi (data-testid → id → name → placeholder → parent scope → `nth=` → text) ve camelCase eleman adı üretimi (Türkçe karakter dönüşümü dahil). `GET /api/recorder/events` (polling), `POST /api/recorder/stop`. `POST /api/run-ui-test`: adımları gerçek tarayıcıda koşturuyor, 4 kademeli click fallback'i var ("self-healing"), sonunda full-page screenshot döndürüyor. |
| `dashboard/src/components/TestRecorderModal.jsx` (yeni, 278) | Recorder başlat/durdur, 600 ms polling, kaydedilen adımları teste ekleme |
| `dashboard/src/pages/TestBuilderPage.jsx` (+238) | UI adımı içeren testlerde runner'a yönlendirme, Headless/Headed toggle, Recorder butonu, screenshot önizleme + zoom modal'ı |
| `dashboard/src/components/StepCard.jsx` | Action / Target By / Selector / **Eleman Adı** ayrı kolonlara bölündü |
| `generator/src/models.ts` | `verifyValue` ve `custom` action tipleri eklendi |
| `generator/tsconfig.json` | `moduleResolution: node` kaldırıldı (TS 6 uyumu) |
| `dashboard/package.json` | `playwright ^1.62.1` bağımlılığı |

**Doğrulama (bugün):** `vite build` başarılı (yalnızca >500 kB chunk uyarısı verdi). `generator` için `tsc --noEmit` hatasız geçti. Playwright `node_modules` içinde kurulu.

## 4. Faz durumu

İki context dosyası birbiriyle çelişiyor: TR'de Aşama 4 = Zeka, EN'de Faz 4 = Monetizasyon. Aşağıdaki tablo EN sürümünü esas alıyor.

| Faz | İçerik | Durum |
|---|---|---|
| 1 | Dashboard, Generator, Live Runner iskeleti | ✅ |
| 2 | Supabase entegrasyonu, auto-save | ✅ |
| 3 | Git push (GitHub/GitLab) | ✅ |
| 4 | Monetizasyon (`is_free`, abonelik limitleri) | ⬜ Başlanmadı |
| 5 | Zeka: Recorder, self-healing, visual testing | 🟡 Recorder + runner commit'lenmemiş halde; visual testing yok; "AI" self-healing şu an sadece metin eşleştirme heuristiği |

## 5. Tespit edilen sorunlar ve borçlar

**Fonksiyonel boşluklar**
1. **Generator, `verifyValue` action'ını desteklemiyor.** Recorder bu adımı üretiyor ama `specGenerator.ts` içinde karşılığı olan bir case yok. Sonuçta generator `// Unknown action` yorumu basıyor.
2. **Üretilen kodda string kaçışı yapılmıyor.** `'${step.value}'` şeklinde yazılıyor; değerin içinde `'` geçerse üretilen `.spec.ts` derlenmiyor.
3. **Recorder'ın ürettiği selector'lar** (`>> nth=`, `:has-text()`, `text=`) generator'daki `css` stratejisine doğrudan gidiyor. Playwright `locator()` bunları kabul ediyor ama kırılgan. Eleman adı boş kalırsa POM getter'ı da oluşmuyor (hedef `page` oluyor ve `page.click()` hatalı kod çıkıyor).
4. Recorder'ın ürettiği `navigate` adımında URL hem `locator.value` hem de `value` alanına yazılıyor. Runner'da `/` ile başlayan relative path'ler env URL'iyle birleşiyor ama tam URL'ler sabit kalıyor, dolayısıyla env değişimi (staging/prod) recorder ile kaydedilmiş testlere yansımıyor.

**Mimari ve deploy**
5. Runner ve Recorder `http://localhost:5175` adresine **hard-coded** bağlı. Vercel'deki canlı sürümde bu butonlar çalışmaz, çünkü Vercel'de proxy veya Playwright yok.
6. `vite.config.js` (534 satır) ile `auth-proxy.js` aynı step-definitions/proxy mantığını tekrar ediyor.
7. `TestBuilderPage.jsx` ~3300 satır. Bölünmesi gerekiyor (runner, terminal, git, step library, modallar).
8. Recorder oturumları bellekte tutuluyor; timeout/cleanup yok, tarayıcı açık kalabilir. Runner'ın `catch` bloğunda `page` değişkeni kapsam dışında (try içinde `const`), bu yüzden hata anında screenshot alınamıyor.

**Güvenlik**
9. Proxy endpoint'leri kimlik doğrulaması olmadan herkese açık (`cors()` tüm origin'lere izin veriyor), ve `--disable-web-security` ile tarayıcı açıyor. Lokal kullanım için kabul edilebilir, deploy edilirse SSRF ve uzaktan tarayıcı açma riski doğar.
10. Git token'larının nerede saklandığı (`services/git.js`) gözden geçirilmeli. Supabase RLS politikaları repoda yok.

**Kalite**
11. Hiç test yok (generator için birim testi bile yok). `dashboard/test-auth.js` ve `test-query.js` dosyaları ad-hoc script.
12. Dokümantasyon güncel değil. Recorder/Runner'dan hiç bahsedilmiyor, faz numaraları da TR ve EN arasında farklı.

## 6. Plan

### Faz 4.5 — Toparlama ✅ (2026-11-09, branch `feature/live-recorder`)
- [x] Commit'lenmemiş Recorder/Runner işini bir feature branch'e commit'le ve push'la (`feature/live-recorder`).
- [x] Generator'a `verifyValue` desteği ekle (`expect(loc).toHaveValue(...)`).
- [x] Generator'da string escape'i `JSON.stringify` ile yap (test/describe başlıkları, URL'ler, API alanları dahil).
- [x] Eleman adı boşsa selector'dan otomatik ad türet; POM'da her UI adımı için getter olsun (`generator/src/utils.ts` → `normalizeSuite`).
- [x] Runner'daki `page` kapsam hatasını düzelt (hata anında screenshot alınabilsin). Ek olarak başarısız koşu artık `success: false` dönüyor.
- [x] Proxy URL'ini `VITE_RUNNER_URL` env değişkenine taşı; proxy erişilemezse UI'da anlaşılır bir mesaj göster (`dashboard/src/lib/runner.js`).
- [x] `PROJECT_CONTEXT*.md` dosyalarını bu plana göre güncelle ve faz numaralarını birleştir.
- Not: Dashboard içindeki "kod önizleme" (`TestBuilderPage.jsx` ~1300. satır) hâlâ kendi ayrı kod üretimini yapıyor ve aynı kaçış sorunlarını taşıyor. Bu kısım Faz 5a'da generator paketine bağlanacak.

### Faz 5a — Recorder/Runner sağlamlaştırma (~1 hafta)
- [ ] Test Builder'daki kod önizlemesini `generator` paketinin çıktısına bağla (iki ayrı codegen'i tekilleştir).
- [ ] `TestRecorderModal.jsx` içindeki lint hatalarını gider (kullanılmayan import'lar, effect içinde setState).
- [ ] Recorder oturumlarına idle timeout ve kapanışta temizlik ekle.
- [ ] Polling yerine SSE (Server-Sent Events) kullan.
- [ ] Recorder kaydında base URL'i ayıklayıp relative path sakla (env geçişi çalışsın).
- [ ] Selector önceliğini Playwright'ın önerdiği locator'lara kaydır (`getByRole`, `getByTestId`, `getByLabel`) ve generator'daki `role`/`text` stratejileriyle hizala.
- [ ] Runner'da `check`/`uncheck`/`custom` adımlarını destekle; adım bazlı screenshot ve süre bilgisi ekle.
- [ ] `vite.config.js` ile `auth-proxy.js` arasındaki tekrarı ortak bir modüle çıkar.

### Faz 5b — Gerçek AI self-healing (~1–2 hafta)
- [ ] Kırılan locator için DOM özeti + adım açıklamasını bir LLM'e gönderip aday selector al ve aday doğrulanırsa uygula.
- [ ] Heal edilen adımları kullanıcı onayına sun (otomatik ezme yerine diff göster).
- [ ] Heal geçmişini Supabase'e kaydet.

### Faz 5c — Visual testing
- [ ] `verifyScreenshot` action'ı ekle: generator `toHaveScreenshot()` üretsin, runner baseline'ı yönetsin.
- [ ] Dashboard'da baseline/actual/diff görüntüleyici yap (mevcut zoom modal'ı yeniden kullanılabilir).

### Faz 4 — Monetizasyon (5a'dan sonra)
- [ ] `profiles.plan` / `is_free` alanını tanımla; proje, test ve runner kullanım limitlerini koy.
- [ ] Ödeme sağlayıcısı entegre et (Stripe veya iyzico) ve webhook → Supabase güncellemesini yap.
- [ ] UI'da limit uyarıları ve upgrade akışı ekle.

### Altyapı (paralel yürütülebilir)
- [ ] Runner'ı ayrı bir servise taşı (`runner/` paketi). Lokal agent olarak mı (CLI, kullanıcı makinesinde) yoksa bulutta mı (Fly.io/Render + Docker Playwright) çalışacağına karar ver. Not: "UPAF bulut koşucusu değildir" kuralıyla çelişmemesi için **lokal agent** daha uygun görünüyor.
- [ ] Proxy'ye Supabase JWT doğrulaması ekle ve CORS'u kısıtla.
- [ ] Supabase şema ve RLS migration'larını repoya ekle.
- [ ] Generator için snapshot testleri yaz (Vitest) ve GitHub Actions'ta build + test çalıştır.
- [ ] `TestBuilderPage.jsx`'i bileşenlere böl ve code-splitting ile 500 kB chunk uyarısını gider.

## 7. Açık kararlar
1. Runner/Recorder nerede çalışacak: kullanıcı makinesinde lokal agent olarak mı, bulutta mı?
2. Faz sırası: önce Monetizasyon mu, önce Zeka mı? (Bu plan önce Zeka'yı öneriyor, çünkü elde neredeyse bitmiş iş var.)
3. AI self-healing için hangi LLM sağlayıcısı kullanılacak ve maliyet hangi pakete yansıtılacak?
