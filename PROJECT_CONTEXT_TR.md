# UPAF (Evrensel Playwright Yapay Zeka Framework) - Proje Bağlamı

## 🎯 Misyon
"Test Otomasyonu Hizmeti" (TaaS) platformu inşa etmek. Kullanıcıların bulut üzerindeki görsel arayüzde tasarladığı UI/API testlerini, arka planda **Playwright + TypeScript (POM)** koduna dönüştürüp müşterinin kendi CI/CD reposuna aktaran (Code Generator) modüler ve yapay zeka destekli bir platform.

## 🚀 Temel Teknoloji Yığını
- **Dashboard (Arayüz):** React + Tailwind (Glassmorphism & Premium UI)
- **Veri & Auth Merkezi:** Supabase
- **Üretici Motor (Generator):** Node.js + TypeScript (JSON'dan Playwright Koduna Çevirici)
- **AI Entegrasyonu:** Yapay zeka destekli locator iyileştirme ve adımları kodlama.

## 🏗️ Sistem Mimarisi
```mermaid
graph TD
    A[UPAF Dashboard (React)] -->|Test Adımlarını Kaydeder (JSON)| B[(Supabase Database)]
    B -->|Tetikler| C{UPAF Generator Motoru}
    C -->|.spec.ts ve POM Üretir| D[Müşteri GitHub / GitLab Reposu]
    D -->|Testleri Koşturur| E[Müşteri CI/CD Pipeline'ı]
```

## 🏗️ Otomasyon Türleri ve Modelleri
1. **API Standart:** Standart API testleri (istek/yanıt doğrulamaları).
2. **UI Otomasyonu:**
    - **Standart UI:** Saf tarayıcı etkileşimleri (tıklama, yazma vb.).
    - **Hibrit (API + UI):** UI etkileşimlerinin arka plandaki ağ (network) istekleriyle doğrulanması.
3. **Görsel Test (Visual Testing):** Piksel tabanlı ekran görüntüsü karşılaştırma ve tasarım doğrulaması.

## 📝 TODO (Gelecek Geliştirmeler)
- **Performans İzleme:** Sayfa yüklenme sürelerinin ve kaynak darboğazlarının detaylı analizi.
- **Kendi Kendini İyileştirme (AI):** Testlerin kırılmasını önlemek için AI kullanarak otomatik locator kurtarma.

## 📐 Genel Kurallar
- **Code Generator Mimari:** UPAF bir bulut koşucusu değil, bir "Kod Üreticisidir". Üretilen kodlar tek yönlü olarak GitHub/GitLab'a pushlanır. Kilitli `upaf-generated` klasör stratejisi izlenir.
- **Mimarisi:** Monorepo (Tek Repo, Çoklu Paket). Tüm alt servisler (`dashboard`, `generator`, `runner`) aynı repoda ama mantıksal olarak ayrı klasörlerde tutulur. Bu sayede kod paylaşımı ve geliştirme hızı maksimize edilir.
- **Sıkı POM:** Tüm sayfa etkileşimleri Page sınıfları içinde otomatik olarak kapsüllenmelidir.
- **Önce Genel (Generic First):** Kod, farklı sektörlere (API, E-ticaret) uyarlanabilecek şekilde olmalıdır.

## Mevcut Durum & İlerleme (Progress)
- [x] **Dashboard UI:** 3 sütunlu IDE yapısı ve Proje Yönetim ekranı tamamlandı.
- [x] **Supabase Entegrasyonu:** Projeler, Test Case'ler ve Adımlar artık gerçek zamanlı olarak veritabanına kaydediliyor.
- [x] **Auto-save Mekanizması:** Test Builder'da yapılan her değişiklik 1 saniye sonra otomatik olarak buluta yedekleniyor.
- [x] **Dinamik API Desteği:** GET, POST, Status Check gibi API aksiyonları StepCard bileşenine entegre edildi.
- [x] **Environment & Variable Sistemi:** Proje bazlı global header ve değişken desteği (Staging/Prod geçişi) tamamlandı.
- [x] **Canlı Runner (Quick Run):** Dashboard içinde gerçek zamanlı API isteği atan ve terminale yazdıran motor kuruldu.
- [x] **Generator Motoru:** JSON verisinden Playwright kodu (Spec + POM) üreten temel motor (`upaf/generator`) kuruldu.
- [x] **Git Entegrasyonu:** Üretilen kodun GitHub/GitLab repolarına otomatik push edilmesi.
- [ ] **Visual Testing:** Ekran görüntüsü karşılaştırma ve visual regression test adımları.

## Yakın Gelecek Planı
1. **Veritabanı (Supabase) Entegrasyonu:** Test Builder'daki adımların ve projelerin LocalStorage'dan alınıp Supabase'deki `projects` ve `test_steps` tablolarına bağlanması.
2. **Git Push Entegrasyonu:** Üretilen kodun kullanıcının reposuna doğrudan Push/PR atılması.
3. **Abonelik (Subscription):** Paket limitlerine göre Dashboard erişim kısıtlamaları.

## 🗺️ Yol Haritası
1. **Aşama 1:** Dashboard, Generator ve Canlı Runner İskeletinin Kurulması ✅ (Tamamlandı).
2. **Aşama 2:** Veritabanı ve Test Builder Veri Entegrasyonu (Supabase) ✅ (Tamamlandı).
3. **Aşama 3:** Git Entegrasyonu (CI/CD Teslimatı) ✅ (Tamamlandı).
4. **Aşama 4:** Zeka Özelliklerinin Eklenmesi (Görsel Testler, Yapay Zeka Locator Kurtarma).
