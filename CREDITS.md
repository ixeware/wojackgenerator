# Credits, sources and licenses

Every external asset is listed in `tools/sources.mjs`; `assets/manifest.json` records the exact source URL of each prepared file.

## Research shown on screen

Citation cards are generated from PubMed records (NCBI E-utilities) for the links in the episode file.

| Card | Record | Figures used |
|---|---|---|
| 2015 | Hutchison MR, White PC. *Prostacyclin regulates bone growth via the Epac/Rap1 pathway.* Endocrinology 2015;156(2):499–510. PMID 25406016 · doi:10.1210/en.2014-1348 | none (© Endocrine Society); the abstract sentence is quoted |
| 2006 | Chang JK et al. *Effects of non-steroidal anti-inflammatory drugs on cell proliferation and death in cultured epiphyseal-articular chondrocytes of fetal rats.* Toxicology 2006;228:111–123. PMID 17045721 | none |
| 2011 | Welting TJM et al. *Inhibition of cyclooxygenase-2 impacts chondrocyte hypertrophic differentiation during endochondral ossification.* Eur Cell Mater 2011;22:420–436. PMID 22183916 | none |
| 2017 | Janssen MP et al. *Impairment of the chondrogenic phase of endochondral ossification in vivo by inhibition of cyclooxygenase-2.* Eur Cell Mater 2017;34:202–216. PMID 29039630 · doi:10.22203/eCM.v034a13 | Fig. 4A (mineralisation front); numbers from Fig. 4B. eCM is open access |
| 2021 | Caron MMJ et al. *Evaluation of impaired growth plate development of long bones in skeletally immature mice by antirheumatic agents.* J Orthop Res 2021;39:553–564. PMID 32740982 · doi:10.1002/jor.24819 · PMC7984053 | Fig. 2B–C and Fig. 3C–D, unmodified crops, **CC BY-NC-ND 4.0** (non-commercial) |
| 1989 | Li XJ, Jee WSS, Li YL. *Flurbiprofen enhances growth and cancellous and cortical bone accumulation in rapidly growing long bones.* Bone 1989;10(1):35–44. PMID 2660884 | none; +30–40% from the abstract |

Figures were taken from the PMC Open Access dataset (`pmc-oa-opendata` bucket) and the eCM publisher PDF, and are shown with their source line.

### Episode 2 (Aqualyx)

| Card | Record |
|---|---|
| 2010 | Thuangtong R et al. *Tissue-selective effects of injected deoxycholate.* Dermatol Surg 2010. PMID 20482723 |
| 2016 | Jones DH et al. *REFINE-1 … Phase 3 Trial With ATX-101.* Dermatol Surg 2016. PMID 26673433 |
| 2016 | Humphrey S et al. *ATX-101 for reduction of submental fat: A phase III randomized controlled trial.* J Am Acad Dermatol 2016. PMID 27430612 |
| 2022 | Shahid S et al. *Chronic Infection and Nodule Formation following Deoxycholate Injection.* Arch Plast Surg 2022. PMID 35832164 |

No figures reused; the bar chart is drawn from the abstracts' numbers. Molecules, fat cells, tissue and the nerve overlay are drawn in SVG.

## Images

- **Pill photographs** — U.S. National Library of Medicine, Computational Photography Project for Pill Identification (C3PI), segmented reference images. U.S. Government work, public domain. Exact file URLs and NDC codes: `assets/manifest.json`.
- **Wojak cast** — [Wojak Land](https://wojakland.com): crying, brainlet, thinking, big-brain, chad, flexing chad, mouse, mouse with glasses, rat, rabbit, pointing hand. Rights remain with their creators.
- **Presenter** (glasses wojak, mouth states, pointing pose) — supplied with the original NSAIDs project; split into body / arm / hand layers by `tools/prepare-assets.mjs`.

## Fonts (SIL Open Font License 1.1, from github.com/google/fonts)

Bricolage Grotesque (headlines, captions) · Onest (labels) · Source Serif 4 (citation cards). License texts are in `assets/fonts/`.

## Voice

ElevenLabs, voice "George", model `eleven_v4`. Generated on a free-tier key: check the plan's commercial-use terms before monetizing the video.

## Background

The paper texture is generated procedurally by `tools/make-paper.mjs` (no external image).

## Sound

All sound effects are synthesized in `engine/audio.mjs` (no samples).
