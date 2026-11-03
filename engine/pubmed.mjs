// Resolves PubMed links from an episode into citation-card data
// (title, first author, journal, year) through NCBI E-utilities. Cached.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const exists = async p => { try { await stat(p); return true; } catch { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function pmidFrom(urlOrId) {
  const m = /(\d{5,9})/.exec(String(urlOrId));
  if (!m) throw new Error(`No PMID in ${urlOrId}`);
  return m[1];
}

const unxml = s => s
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x?([0-9a-f]+);/gi,
    (_, n) => String.fromCodePoint(parseInt(n, /x/i.test(_) ? 16 : 10)))
  .replace(/&amp;/g, '&').trim();

function pick(xml, re) { const m = re.exec(xml); return m ? unxml(m[1]) : null; }

function parse(xml, pmid) {
  const article = /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/.exec(xml)?.[0] ?? xml;
  const title = pick(article, /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/).replace(/\.$/, '');
  const journal = pick(article, /<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/) ?? pick(article, /<Title>([\s\S]*?)<\/Title>/);
  const year = pick(article, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ?? pick(article, /<MedlineDate>(\d{4})/);
  const authors = [...article.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g)].map(m => {
    const fore = pick(m[1], /<ForeName>([\s\S]*?)<\/ForeName>/);
    const last = pick(m[1], /<LastName>([\s\S]*?)<\/LastName>/) ?? pick(m[1], /<CollectiveName>([\s\S]*?)<\/CollectiveName>/);
    return [fore, last].filter(Boolean).join(' ');
  });
  const doi = pick(article, /<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
  // PubMed's own card format: "Kirby C Stafford et al. J Med Entomol. 2021."
  const byline = authors.length > 1 ? `${authors[0]} et al.` : (authors[0] ?? '');
  return { pmid, title, journal: journal?.replace(/\.$/, ''), year: year ? +year : null, authors, byline, doi,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
}

export async function resolvePapers(papers, cacheDir) {
  await mkdir(cacheDir, { recursive: true });
  const out = {};
  for (const [key, ref] of Object.entries(papers)) {
    const pmid = pmidFrom(ref.url ?? ref.pmid);
    const file = join(cacheDir, `${pmid}.json`);
    let data;
    if (await exists(file)) data = JSON.parse(await readFile(file, 'utf8'));
    else {
      const res = await fetch(`${EUTILS}?db=pubmed&id=${pmid}&retmode=xml&tool=wojackgenerator`);
      if (!res.ok) throw new Error(`PubMed ${res.status} for ${pmid}`);
      data = parse(await res.text(), pmid);
      await writeFile(file, JSON.stringify(data, null, 2));
      await sleep(350); // NCBI asks for ≤3 requests/s without an API key
    }
    out[key] = { ...data, ...ref, pmid };
    console.log(`  paper ${key}: ${data.byline} ${data.journal}. ${data.year}.`);
  }
  return out;
}
