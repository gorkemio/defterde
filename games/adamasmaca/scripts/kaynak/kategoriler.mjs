// scripts/kaynak/kategoriler.mjs — kategori kelime listeleri (elle yazıldı).
// hazirla.mjs her kelimeyi TDK listesine karşı doğrular; bulunamayanlar scripts/rapor.md'ye "yazım hatası ya da
// özel ad?" diye yazılır ve oyuna ALINMAZ (burada düzeltilip hazirla yeniden çalıştırılır).
// Yazım serbest (büyük/küçük, şapkalı); hazirla normalize eder. Kelime başına tek sözcük, 3–14 harf.

const kelimeler = (s) => s.split(/\s+/).filter(Boolean);

/* ---------- Şehirler: 81 il. [plaka, ad, bölge] ---------- */
export const SEHIRLER = [
  [1, 'Adana', 'Akdeniz'], [2, 'Adıyaman', 'Güneydoğu Anadolu'], [3, 'Afyonkarahisar', 'Ege'], [4, 'Ağrı', 'Doğu Anadolu'],
  [5, 'Amasya', 'Karadeniz'], [6, 'Ankara', 'İç Anadolu'], [7, 'Antalya', 'Akdeniz'], [8, 'Artvin', 'Karadeniz'],
  [9, 'Aydın', 'Ege'], [10, 'Balıkesir', 'Marmara'], [11, 'Bilecik', 'Marmara'], [12, 'Bingöl', 'Doğu Anadolu'],
  [13, 'Bitlis', 'Doğu Anadolu'], [14, 'Bolu', 'Karadeniz'], [15, 'Burdur', 'Akdeniz'], [16, 'Bursa', 'Marmara'],
  [17, 'Çanakkale', 'Marmara'], [18, 'Çankırı', 'İç Anadolu'], [19, 'Çorum', 'Karadeniz'], [20, 'Denizli', 'Ege'],
  [21, 'Diyarbakır', 'Güneydoğu Anadolu'], [22, 'Edirne', 'Marmara'], [23, 'Elazığ', 'Doğu Anadolu'], [24, 'Erzincan', 'Doğu Anadolu'],
  [25, 'Erzurum', 'Doğu Anadolu'], [26, 'Eskişehir', 'İç Anadolu'], [27, 'Gaziantep', 'Güneydoğu Anadolu'], [28, 'Giresun', 'Karadeniz'],
  [29, 'Gümüşhane', 'Karadeniz'], [30, 'Hakkâri', 'Doğu Anadolu'], [31, 'Hatay', 'Akdeniz'], [32, 'Isparta', 'Akdeniz'],
  [33, 'Mersin', 'Akdeniz'], [34, 'İstanbul', 'Marmara'], [35, 'İzmir', 'Ege'], [36, 'Kars', 'Doğu Anadolu'],
  [37, 'Kastamonu', 'Karadeniz'], [38, 'Kayseri', 'İç Anadolu'], [39, 'Kırklareli', 'Marmara'], [40, 'Kırşehir', 'İç Anadolu'],
  [41, 'Kocaeli', 'Marmara'], [42, 'Konya', 'İç Anadolu'], [43, 'Kütahya', 'Ege'], [44, 'Malatya', 'Doğu Anadolu'],
  [45, 'Manisa', 'Ege'], [46, 'Kahramanmaraş', 'Akdeniz'], [47, 'Mardin', 'Güneydoğu Anadolu'], [48, 'Muğla', 'Ege'],
  [49, 'Muş', 'Doğu Anadolu'], [50, 'Nevşehir', 'İç Anadolu'], [51, 'Niğde', 'İç Anadolu'], [52, 'Ordu', 'Karadeniz'],
  [53, 'Rize', 'Karadeniz'], [54, 'Sakarya', 'Marmara'], [55, 'Samsun', 'Karadeniz'], [56, 'Siirt', 'Güneydoğu Anadolu'],
  [57, 'Sinop', 'Karadeniz'], [58, 'Sivas', 'İç Anadolu'], [59, 'Tekirdağ', 'Marmara'], [60, 'Tokat', 'Karadeniz'],
  [61, 'Trabzon', 'Karadeniz'], [62, 'Tunceli', 'Doğu Anadolu'], [63, 'Şanlıurfa', 'Güneydoğu Anadolu'], [64, 'Uşak', 'Ege'],
  [65, 'Van', 'Doğu Anadolu'], [66, 'Yozgat', 'İç Anadolu'], [67, 'Zonguldak', 'Karadeniz'], [68, 'Aksaray', 'İç Anadolu'],
  [69, 'Bayburt', 'Karadeniz'], [70, 'Karaman', 'İç Anadolu'], [71, 'Kırıkkale', 'İç Anadolu'], [72, 'Batman', 'Güneydoğu Anadolu'],
  [73, 'Şırnak', 'Güneydoğu Anadolu'], [74, 'Bartın', 'Karadeniz'], [75, 'Ardahan', 'Doğu Anadolu'], [76, 'Iğdır', 'Doğu Anadolu'],
  [77, 'Yalova', 'Marmara'], [78, 'Karabük', 'Karadeniz'], [79, 'Kilis', 'Güneydoğu Anadolu'], [80, 'Osmaniye', 'Akdeniz'],
  [81, 'Düzce', 'Karadeniz'],
];
export const sehirIpucu = ([plaka, , bolge]) => `${bolge} Bölgesi'nde bir il. Plaka kodu ${String(plaka).padStart(2, '0')}.`;

/* ---------- Ülkeler: [ad, kıta, başkent]. Tek sözcüklü adlar; tartışmalı olanlar alınmadı. ---------- */
export const ULKELER = [
  // Asya
  ['Türkiye', 'Asya ve Avrupa', 'Ankara'], ['Afganistan', 'Asya', 'Kabil'], ['Azerbaycan', 'Asya', 'Bakü'], ['Bahreyn', 'Asya', 'Manama'],
  ['Bangladeş', 'Asya', 'Dakka'], ['Bhutan', 'Asya', 'Thimphu'], ['Brunei', 'Asya', 'Bandar Seri Begawan'], ['Çin', 'Asya', 'Pekin'],
  ['Endonezya', 'Asya', 'Cakarta'], ['Filipinler', 'Asya', 'Manila'], ['Gürcistan', 'Asya', 'Tiflis'], ['Hindistan', 'Asya', 'Yeni Delhi'],
  ['Irak', 'Asya', 'Bağdat'], ['İran', 'Asya', 'Tahran'], ['Japonya', 'Asya', 'Tokyo'], ['Kamboçya', 'Asya', 'Phnom Penh'],
  ['Katar', 'Asya', 'Doha'], ['Kazakistan', 'Asya', 'Astana'], ['Kırgızistan', 'Asya', 'Bişkek'], ['Kuveyt', 'Asya', 'Kuveyt'],
  ['Laos', 'Asya', 'Vientiane'], ['Lübnan', 'Asya', 'Beyrut'], ['Malezya', 'Asya', 'Kuala Lumpur'], ['Maldivler', 'Asya', 'Male'],
  ['Moğolistan', 'Asya', 'Ulan Batur'], ['Myanmar', 'Asya', 'Naypyidaw'], ['Nepal', 'Asya', 'Katmandu'], ['Özbekistan', 'Asya', 'Taşkent'],
  ['Pakistan', 'Asya', 'İslamabad'], ['Singapur', 'Asya', 'Singapur'], ['Suriye', 'Asya', 'Şam'], ['Tacikistan', 'Asya', 'Duşanbe'],
  ['Tayland', 'Asya', 'Bangkok'], ['Türkmenistan', 'Asya', 'Aşkabat'], ['Umman', 'Asya', 'Maskat'], ['Ürdün', 'Asya', 'Amman'],
  ['Vietnam', 'Asya', 'Hanoi'], ['Yemen', 'Asya', 'Sana'], ['Ermenistan', 'Asya', 'Erivan'],
  // Avrupa
  ['Almanya', 'Avrupa', 'Berlin'], ['Andorra', 'Avrupa', 'Andorra la Vella'], ['Arnavutluk', 'Avrupa', 'Tiran'], ['Avusturya', 'Avrupa', 'Viyana'],
  ['Belçika', 'Avrupa', 'Brüksel'], ['Belarus', 'Avrupa', 'Minsk'], ['Bulgaristan', 'Avrupa', 'Sofya'], ['Çekya', 'Avrupa', 'Prag'],
  ['Danimarka', 'Avrupa', 'Kopenhag'], ['Estonya', 'Avrupa', 'Tallinn'], ['Finlandiya', 'Avrupa', 'Helsinki'], ['Fransa', 'Avrupa', 'Paris'],
  ['Hırvatistan', 'Avrupa', 'Zagreb'], ['Hollanda', 'Avrupa', 'Amsterdam'], ['İngiltere', 'Avrupa', 'Londra'], ['İrlanda', 'Avrupa', 'Dublin'],
  ['İspanya', 'Avrupa', 'Madrid'], ['İsveç', 'Avrupa', 'Stockholm'], ['İsviçre', 'Avrupa', 'Bern'], ['İtalya', 'Avrupa', 'Roma'],
  ['İzlanda', 'Avrupa', 'Reykjavik'], ['Karadağ', 'Avrupa', 'Podgorica'], ['Letonya', 'Avrupa', 'Riga'], ['Lihtenştayn', 'Avrupa', 'Vaduz'],
  ['Litvanya', 'Avrupa', 'Vilnius'], ['Lüksemburg', 'Avrupa', 'Lüksemburg'], ['Macaristan', 'Avrupa', 'Budapeşte'], ['Malta', 'Avrupa', 'Valletta'],
  ['Moldova', 'Avrupa', 'Kişinev'], ['Monako', 'Avrupa', 'Monako'], ['Norveç', 'Avrupa', 'Oslo'], ['Polonya', 'Avrupa', 'Varşova'],
  ['Portekiz', 'Avrupa', 'Lizbon'], ['Romanya', 'Avrupa', 'Bükreş'], ['Rusya', 'Avrupa', 'Moskova'], ['Sırbistan', 'Avrupa', 'Belgrad'],
  ['Slovakya', 'Avrupa', 'Bratislava'], ['Slovenya', 'Avrupa', 'Ljubljana'], ['Ukrayna', 'Avrupa', 'Kiev'], ['Vatikan', 'Avrupa', 'Vatikan'],
  ['Yunanistan', 'Avrupa', 'Atina'],
  // Afrika
  ['Angola', 'Afrika', 'Luanda'], ['Benin', 'Afrika', 'Porto-Novo'], ['Botsvana', 'Afrika', 'Gaborone'], ['Cezayir', 'Afrika', 'Cezayir'],
  ['Cibuti', 'Afrika', 'Cibuti'], ['Çad', 'Afrika', 'Encamena'], ['Eritre', 'Afrika', 'Asmara'], ['Etiyopya', 'Afrika', 'Addis Ababa'],
  ['Fas', 'Afrika', 'Rabat'], ['Gabon', 'Afrika', 'Libreville'], ['Gambiya', 'Afrika', 'Banjul'], ['Gana', 'Afrika', 'Akra'],
  ['Gine', 'Afrika', 'Konakri'], ['Kamerun', 'Afrika', 'Yaounde'], ['Kenya', 'Afrika', 'Nairobi'], ['Komorlar', 'Afrika', 'Moroni'],
  ['Lesotho', 'Afrika', 'Maseru'], ['Liberya', 'Afrika', 'Monrovya'], ['Libya', 'Afrika', 'Trablus'], ['Madagaskar', 'Afrika', 'Antananarivo'],
  ['Malavi', 'Afrika', 'Lilongve'], ['Mali', 'Afrika', 'Bamako'], ['Moritanya', 'Afrika', 'Nuakşot'], ['Mısır', 'Afrika', 'Kahire'],
  ['Moritus', 'Afrika', 'Port Louis'], ['Mozambik', 'Afrika', 'Maputo'], ['Namibya', 'Afrika', 'Vindhuk'], ['Nijer', 'Afrika', 'Niamey'],
  ['Nijerya', 'Afrika', 'Abuja'], ['Ruanda', 'Afrika', 'Kigali'], ['Senegal', 'Afrika', 'Dakar'], ['Seyşeller', 'Afrika', 'Victoria'],
  ['Somali', 'Afrika', 'Mogadişu'], ['Sudan', 'Afrika', 'Hartum'], ['Tanzanya', 'Afrika', 'Dodoma'], ['Togo', 'Afrika', 'Lome'],
  ['Tunus', 'Afrika', 'Tunus'], ['Uganda', 'Afrika', 'Kampala'], ['Zambiya', 'Afrika', 'Lusaka'], ['Zimbabve', 'Afrika', 'Harare'],
  // Kuzey ve Güney Amerika, Okyanusya
  ['Kanada', 'Kuzey Amerika', 'Ottawa'], ['Meksika', 'Kuzey Amerika', 'Meksiko'], ['Küba', 'Kuzey Amerika', 'Havana'], ['Jamaika', 'Kuzey Amerika', 'Kingston'],
  ['Haiti', 'Kuzey Amerika', 'Port-au-Prince'], ['Bahamalar', 'Kuzey Amerika', 'Nassau'], ['Barbados', 'Kuzey Amerika', 'Bridgetown'], ['Belize', 'Kuzey Amerika', 'Belmopan'],
  ['Panama', 'Kuzey Amerika', 'Panama'], ['Nikaragua', 'Kuzey Amerika', 'Managua'], ['Honduras', 'Kuzey Amerika', 'Tegucigalpa'], ['Guatemala', 'Kuzey Amerika', 'Guatemala'],
  ['Arjantin', 'Güney Amerika', 'Buenos Aires'], ['Brezilya', 'Güney Amerika', 'Brasilia'], ['Şili', 'Güney Amerika', 'Santiago'], ['Ekvador', 'Güney Amerika', 'Quito'],
  ['Guyana', 'Güney Amerika', 'Georgetown'], ['Kolombiya', 'Güney Amerika', 'Bogota'], ['Paraguay', 'Güney Amerika', 'Asunción'], ['Peru', 'Güney Amerika', 'Lima'],
  ['Surinam', 'Güney Amerika', 'Paramaribo'], ['Uruguay', 'Güney Amerika', 'Montevideo'], ['Venezuela', 'Güney Amerika', 'Karakas'],
  ['Avustralya', 'Okyanusya', 'Canberra'], ['Fiji', 'Okyanusya', 'Suva'], ['Samoa', 'Okyanusya', 'Apia'], ['Vanuatu', 'Okyanusya', 'Port Vila'],
];
// Başkent ülkeyle aynı adı taşıyorsa (Singapur, Tunus, Panama…) ad ipucunda geçmesin
export const ulkeIpucu = ([ad, kita, baskent]) => (baskent.toLocaleLowerCase('tr-TR').includes(ad.toLocaleLowerCase('tr-TR'))
  ? `${kita}'da bir ülke. Başkenti, ülkeyle aynı adı taşır.`
  : `${kita}'da bir ülke. Başkenti ${baskent}.`);

/* ---------- Diğer kategoriler: TDK'daki ilk anlam gösterilir ---------- */
export const KATEGORILER = {
  Hayvanlar: kelimeler(`
    aslan kaplan leopar çita jaguar puma vaşak kurt tilki çakal sırtlan ayı panda koala kanguru zürafa fil gergedan  zebra
    eşek katır inek boğa öküz manda koyun koç kuzu keçi oğlak domuz tavuk horoz civciv ördek kaz hindi güvercin kartal şahin doğan
    atmaca baykuş karga kuzgun serçe bülbül kanarya papağan leylek turna flamingo pelikan martı albatros penguen kaplumbağa kertenkele
    timsah bukalemun yılan kobra engerek kurbağa semender balık  balina yunus fok mors ahtapot karides yengeç ıstakoz midye
    istiridye denizanası denizyıldızı denizatı kedi köpek tavşan  fare sıçan kobay sincap kirpi köstebek yarasa gelincik porsuk
    samur sansar kunduz rakun antilop ceylan geyik karaca deve lama alpaka bizon yak karınca arı sinek sivrisinek kelebek böcek
     çekirge   örümcek akrep kene pire bit solucan salyangoz maymun goril şempanze orangutan babun
    lemur karıncayiyen  bıldırcın sülün keklik ağaçkakan guguk kırlangıç kuğu kivi  akbaba çaylak sığırcık ispinoz
    kumru levrek çipura hamsi sardalya palamut lüfer uskumru alabalık sazan yayın morina somon orkinos kalkan vatoz mercan barbun
    istavrit kefal çinekop zargana kalamar  
  `),
  'Meyve-Sebze': kelimeler(`
    elma armut ayva kiraz vişne çilek ahududu böğürtlen üzüm incir hurma nar şeftali kayısı erik muz portakal mandalina limon greyfurt
    turunç kivi ananas avokado mango papaya karpuz kavun dut kızılcık kuşburnu muşmula kestane fındık fıstık ceviz badem domates
    salatalık biber patlıcan kabak havuç patates soğan sarımsak ıspanak marul lahana karnabahar brokoli pırasa kereviz turp pancar
    bezelye fasulye bakla mısır maydanoz dereotu nane reyhan roka tere enginar kuşkonmaz bamya mantar nohut mercimek barbunya börülce
    şalgam  biberiye zencefil frambuaz semizotu   ahlat alıç mersin bergamot pazı ısırgan soya yulaf
    arpa buğday çavdar pirinç susam kimyon kekik
  `),
  Meslekler: kelimeler(`
    doktor hekim cerrah hemşire eczacı dişçi öğretmen müdür mühendis mimar avukat hâkim savcı polis jandarma asker pilot kaptan denizci
    itfaiyeci aşçı garson tezgâhtar kasiyer satıcı bakkal manav kasap fırıncı pastacı berber kuaför terzi ayakkabıcı marangoz tesisatçı
    elektrikçi boyacı çiftçi balıkçı çoban arıcı bahçıvan ormancı madenci inşaatçı duvarcı demirci kaynakçı tornacı şoför makinist
    sürücü postacı kurye gazeteci muhabir yazar şair ressam heykeltıraş müzisyen şarkıcı oyuncu yönetmen fotoğrafçı tasarımcı bilgin
    araştırmacı astronot astronom fizikçi kimyager biyolog matematikçi tarihçi psikolog diyetisyen veteriner hakem antrenör futbolcu
    sporcu dansçı palyaço sihirbaz hizmetli temizlikçi bekçi muhasebeci bankacı sekreter tercüman rehber kütüphaneci eğitmen okutman
    dadı bakıcı çevirmen noter memur işçi usta çırak kalfa esnaf tüccar patron yönetici başkan vali kaymakam elçi diplomat dedektif
    hamal lokantacı simitçi tamirci kuyumcu saatçi gözlükçü optisyen ebe  teknisyen programcı  girişimci reklamcı
    modacı makyöz kondüktör hostes stajyer tabelacı bisikletçi sucu bozacı tenekeci sepetçi
  `),
  Okul: kelimeler(`
    okul sınıf öğretmen öğrenci tebeşir silgi kalem kalemlik kalemtıraş defter kitap çanta cetvel gönye pergel makas yapıştırıcı boya
    pastel  fırça resim müzik matematik fen türkçe edebiyat tarih coğrafya fizik kimya biyoloji felsefe beden ders teneffüs zil
    bahçe kantin kütüphane laboratuvar müdür müfettiş karne sınav ödev not yoklama tören bayrak forma önlük harita küre pano sıra masa
    sandalye dolap dosya klasör  zımba delgeç okuma yazma toplama çıkarma çarpma bölme kesir rakam sayı harf hece sözcük cümle
    paragraf alfabe sözlük atlas ansiklopedi roman masal şiir öykü hikâye kompozisyon dikte deney mikroskop teleskop burs diploma
    mezun veli rehberlik kreş anaokulu ilkokul ortaokul lise üniversite fakülte kampüs tahta duvar pencere kapı koridor servis
    tatil dönem yıl hafta
  `),
  Mutfak: kelimeler(`
    tencere tava kapak kepçe kaşık çatal bıçak tabak bardak fincan kupa çaydanlık demlik semaver cezve sürahi sahan güveç tepsi leğen
    kevgir süzgeç rende oklava merdane çırpıcı fırın ocak tüp buzdolabı dondurucu bulaşık mikser blender tost kavanoz şişe tuzluk
    biberlik şekerlik peçete örtü tezgâh  musluk lavabo mutfak yemek kahvaltı çorba pilav makarna köfte kebap döner lahmacun pide
    börek gözleme mantı dolma sarma menemen omlet yumurta peynir zeytin reçel bal tereyağı yoğurt ayran süt çay kahve şeker tuz biber
    baharat yağ sirke maya pasta kek kurabiye baklava lokum helva kadayıf sütlaç aşure dondurma çikolata bisküvi simit ekmek
    poğaça açma tatlı turşu salata meze haydari komposto limonata gazoz  şerbet hoşaf bulgur irmik nişasta
    pekmez tahin kaymak lor çökelek sucuk pastırma sosis jambon salam kıyma tavuk balık
  `),
  Spor: kelimeler(`
    futbol basketbol voleybol hentbol tenis badminton yüzme atletizm koşu güreş boks judo karate tekvando eskrim okçuluk binicilik
    jimnastik halter bisiklet kayak paten kürek yelken dalış sörf golf ragbi beyzbol kriket hokey dart bilardo satranç tırmanış
    dağcılık triatlon maraton sprint gol pas şut korner ofsayt penaltı faul hakem forma kale kaleci defans forvet stat stadyum saha top
    file pota raket smaç blok servis madalya kupa şampiyon takım antrenör antrenman maç lig tribün taraftar seyirci kronometre düdük
    oyuncu yedek kaptan puan skor rekor yarış koşucu yüzücü güreşçi boksör sporcu atlet paraşüt kano rafting
     tavla briç eskrimci kayakçı
  `),
  Doğa: kelimeler(`
    ağaç çiçek yaprak dal kök gövde orman çam meşe kayın kavak çınar söğüt ladin köknar zeytin palmiye bambu çimen  yosun mantar gül
    papatya lale sümbül nergis menekşe karanfil orkide ayçiçeği gelincik zambak dağ tepe vadi ova yayla kayalık uçurum mağara volkan
    çöl vaha ada yarımada körfez koy kıyı sahil plaj deniz okyanus göl nehir ırmak dere çay pınar şelale gölet bataklık buzul kar
    yağmur dolu sis bulut rüzgâr fırtına şimşek yıldırım gökkuşağı güneş  yıldız gezegen dünya uzay atmosfer iklim mevsim ilkbahar yaz
    sonbahar kış toprak kum taş kaya çakıl maden kömür altın gümüş elmas mercan inci çiğ kırağı kasırga deprem sel hava sıcaklık
    nem gökyüzü ufuk gün gece şafak yamaç kanyon gayzer fosil
  `),
  Vücut: kelimeler(`
    baş kafa saç kaş kirpik göz burun kulak ağız dudak diş dil çene yanak alın boyun omuz kol dirsek bilek  parmak tırnak avuç göğüs
    sırt karın bel kalça bacak diz ayak topuk kalp akciğer mide karaciğer böbrek bağırsak beyin kemik kas deri damar kan cilt
    kafatası omurga kaburga eklem sinir ter gözyaşı nefes nabız boğaz damak gırtlak yutak dalak safra sakal bıyık
    başparmak yüz çehre şakak ense baldır göbek gövde iskelet kıkırdak gamze çil ben sivilce yumruk doku hücre kornea retina pankreas yürek omurilik azı
  `),
};
