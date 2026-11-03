// Every external asset used by the engine, with its origin.
// `node tools/fetch-assets.mjs` downloads these into assets/_raw,
// `node tools/prepare-assets.mjs` turns them into the trimmed sprites in assets/.

export const NLM_PILLS = 'https://data.lhncbc.nlm.nih.gov/public/Pills/';

// NLM Computational Photography Project for Pill Identification (C3PI).
// U.S. National Library of Medicine, public domain. The *_SEG images are
// background-removed reference photographs of a specific NDC product.
export const pills = [
  { id: 'ibuprofen',    label: 'Ibuprofen',    strength: '200 mg', ndc: '50844029108',
    path: 'PillProjectDisc107/images/X_-L2E4EVGG8WNIJ48TEKB-JA_4TQV.PNG' },
  { id: 'aspirin',      label: 'Aspirin',      strength: '325 mg', ndc: '00536308610',
    path: 'PillProjectDisc107/images/XTP-CFCS4ARHM46DL4B_D7RHBPQPC!.PNG' },
  { id: 'naproxen',     label: 'Naproxen',     strength: '500 mg', ndc: '00093014701',
    path: 'PillProjectDisc100/images/RN!3QUD7YQHLF8L5RO3LVJ_D1PMGZ7.PNG' },
  { id: 'celecoxib',    label: 'Celecoxib',    strength: '100 mg', ndc: '00025152031',
    path: 'PillProjectDisc107/images/X6YCBP9ZRBPNNE3R!O54AESEWM01HB.PNG' },
  { id: 'flurbiprofen', label: 'Flurbiprofen', strength: '100 mg', ndc: '00093071101',
    path: 'PillProjectDisc100/images/QSX!1DP1GM__A5_186WL6985Z_UYSJ.PNG' },
  { id: 'indomethacin', label: 'Indomethacin', strength: '50 mg',  ndc: '00093402901',
    path: 'PillProjectDisc108/images/Z2VW-3FR7UNUYL06B161TQX3DRNSFR.PNG' },
  { id: 'ketorolac',    label: 'Ketorolac',    strength: '10 mg',  ndc: '00093031401',
    path: 'PillProjectDisc107/images/XDYIKARS6FBEIYA67UWPAY_PCCUGC9.PNG' },
  { id: 'diclofenac',   label: 'Diclofenac',   strength: '75 mg',  ndc: '00228255006',
    path: 'PillProjectDisc110/images/_P73WU5I4P0OHEWNH240QJ!VWHVQ5N.PNG' },
  { id: 'piroxicam',    label: 'Piroxicam',    strength: '20 mg',  ndc: '00093075601',
    path: 'PillProjectDisc108/images/YLQFTNQDL3ZOF-S05EM6!1WIY933E3.PNG' },
];

// Wojak Land (https://wojakland.com) — meme character art used for the
// reaction cast. Attribution kept in CREDITS.md.
export const WOJAK_BASE = 'https://wojakland.com/wp-content/grand-media/image/';
export const wojaks = [
  { id: 'crying',        file: 'CryingWojak.png',               page: 'https://wojakland.com/crying' },
  { id: 'crying-glass',  file: 'front_view_crying_wojak.png',   page: 'https://wojakland.com/crying' },
  { id: 'nooo',          file: 'NOOOyouCantJust.png',           page: 'https://wojakland.com/crying' },
  { id: 'brainlet',      file: 'small_brain_brainlet.png',      page: 'https://wojakland.com/brainlets' },
  { id: 'thinking',      file: 'ThinkingBrainlet.png',          page: 'https://wojakland.com/brainlets' },
  { id: 'bigbrain',      file: 'wojak-big-brain-small-glasses.png', page: 'https://wojakland.com/big-brain' },
  { id: 'chad',          file: 'GrayChad.png',                  page: 'https://wojakland.com/chads' },
  { id: 'chad-flex',     file: 'flexing_full_body_chad.png',    page: 'https://wojakland.com/chads' },
  { id: 'mouse',         file: 'mouse_wojak.png',               page: 'https://wojakland.com/animals' },
  { id: 'mouse-glasses', file: 'mouse_with_glasses_soyjak.png', page: 'https://wojakland.com/animals' },
  { id: 'rat',           file: 'White_Rat_with_Cheese_wojak.png', page: 'https://wojakland.com/animals' },
  { id: 'rabbit',        file: 'rabbit_groomer.png',            page: 'https://wojakland.com/animals' },
  { id: 'hand-point',    file: 'wojak_hand_pointing.png',       page: 'https://wojakland.com/wojak-pointing' },
];

// Open-access figures from the papers the script cites.
export const figures = [
  { id: 'caron-length',
    from: 'https://pmc-oa-opendata.s3.amazonaws.com/PMC7984053.1/PMC7984053.1.pdf',
    kind: 'pdf', page: 6, index: 1,
    crop: 'B-C',
    cite: 'Caron et al. 2021 · J Orthop Res · Fig. 2 (CC BY-NC-ND 4.0)' },
  { id: 'caron-zones',
    from: 'https://pmc-oa-opendata.s3.amazonaws.com/PMC7984053.1/PMC7984053.1.pdf',
    kind: 'pdf', page: 7, index: 2,
    cite: 'Caron et al. 2021 · J Orthop Res · Fig. 3 (CC BY-NC-ND 4.0)' },
  { id: 'janssen-front',
    from: 'https://storage.forummmpub.com/FMP/1968522426548588544/application/v034a13.pdf',
    kind: 'pdf', page: 8, index: 4,
    cite: 'Janssen et al. 2017 · eCM · Fig. 4 (open access)' },
];

// Google Fonts, SIL Open Font License 1.1.
export const fonts = [
  { id: 'Bricolage',  file: 'BricolageGrotesque[opsz,wdth,wght].ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf',
    license: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt' },
  { id: 'Onest',      file: 'Onest[wght].ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/onest/Onest%5Bwght%5D.ttf',
    license: 'https://raw.githubusercontent.com/google/fonts/main/ofl/onest/OFL.txt' },
  { id: 'SourceSerif', file: 'SourceSerif4[opsz,wght].ttf',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/SourceSerif4%5Bopsz%2Cwght%5D.ttf',
    license: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/OFL.txt' },
];
