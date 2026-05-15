import { load } from "cheerio";
import { readFile } from "node:fs/promises";
import path from "node:path";

const appId = process.env.DOCSEARCH_APP_ID;
const apiKey = process.env.DOCSEARCH_ADMIN_API_KEY;
const indexName = process.env.DOCSEARCH_INDEX_NAME || "javaguide";
const sitemapUrl =
  process.env.DOCSEARCH_SITEMAP_URL || "https://javaguide.cn/sitemap.xml";
const sourceDir = process.env.DOCSEARCH_SOURCE_DIR;
const maxUrls = Number(process.env.DOCSEARCH_MAX_URLS || 0);
const concurrency = Number(process.env.DOCSEARCH_CONCURRENCY || 6);

if (!appId || !apiKey) {
  console.error(
    "Missing DOCSEARCH_APP_ID or DOCSEARCH_ADMIN_API_KEY environment variable.",
  );
  process.exit(1);
}

const algoliaHost = `https://${appId}.algolia.net`;
const algoliaHeaders = {
  "X-Algolia-Application-Id": appId,
  "X-Algolia-API-Key": apiKey,
  "Content-Type": "application/json",
};

const textOf = ($, selector) =>
  $(selector).first().text().replace(/\s+/g, " ").trim();

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

async function algoliaRequest(path, body, method = "POST") {
  const response = await fetch(`${algoliaHost}${path}`, {
    method,
    headers: algoliaHeaders,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Algolia request failed ${response.status}: ${text}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "JavaGuide-DocSearch-Indexer/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} responded with HTTP ${response.status}`);
  }

  return response.text();
}

async function readSitemap() {
  if (!sourceDir) {
    return fetchText(sitemapUrl);
  }

  return readFile(path.join(sourceDir, "sitemap.xml"), "utf8");
}

async function readPageHtml(url) {
  if (!sourceDir) {
    return fetchText(url);
  }

  const { pathname } = new URL(url);
  const relativePath =
    pathname === "/"
      ? "index.html"
      : pathname.endsWith("/")
        ? path.join(decodeURIComponent(pathname.slice(1)), "index.html")
        : decodeURIComponent(pathname.slice(1));

  return readFile(path.join(sourceDir, relativePath), "utf8");
}

function extractUrlsFromSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1].trim())
    .filter((url) => url.startsWith("https://javaguide.cn/"))
    .filter((url) => !url.includes("/assets/"))
    .filter((url) => !url.endsWith("/404.html"));

  return maxUrls > 0 ? urls.slice(0, maxUrls) : urls;
}

function recordFor({ url, title, hierarchy, content, anchor, type, position }) {
  const recordUrl = anchor ? `${url}#${anchor}` : url;

  return {
    objectID: `${slug(url)}-${anchor || "page"}-${position}`,
    hierarchy,
    content,
    anchor,
    url: recordUrl,
    url_without_anchor: url,
    type,
    lang: "zh-CN",
    language: "zh-CN",
    version: "current",
    tags: ["javaguide"],
    weight: {
      pageRank: 0,
      level: type === "content" ? 0 : Number(type.replace("lvl", "")) || 0,
      position,
    },
    title,
  };
}

function extractRecords(url, html) {
  const $ = load(html);
  const contentRoot = $("#markdown-content");

  if (!contentRoot.length) {
    return [];
  }

  const title =
    textOf($, ".vp-page-title h1") ||
    textOf($, "main h1") ||
    textOf($, "title") ||
    "JavaGuide";

  const hierarchy = {
    lvl0: "JavaGuide",
    lvl1: title,
    lvl2: null,
    lvl3: null,
    lvl4: null,
    lvl5: null,
    lvl6: null,
  };
  const records = [
    recordFor({
      url,
      title,
      hierarchy: { ...hierarchy },
      content: null,
      anchor: null,
      type: "lvl1",
      position: 0,
    }),
  ];
  let currentAnchor = null;

  contentRoot
    .find("h2,h3,h4,h5,h6,p,li,td,blockquote")
    .each((index, element) => {
      const tag = element.name;
      const content = $(element).text().replace(/\s+/g, " ").trim();

      if (!content) {
        return;
      }

      const isHeading = /^h[2-6]$/.test(tag);

      if (isHeading) {
        const level = Number(tag.slice(1));

        for (let i = level; i <= 6; i += 1) {
          hierarchy[`lvl${i}`] = null;
        }

        hierarchy[`lvl${level}`] = content;
        currentAnchor = $(element).attr("id") || currentAnchor;
      }

      const anchor =
        $(element).attr("id") ||
        $(element).closest("[id]").attr("id") ||
        currentAnchor;

      records.push(
        recordFor({
          url,
          title,
          hierarchy: { ...hierarchy },
          content: isHeading ? null : content,
          anchor,
          type: isHeading ? `lvl${tag.slice(1)}` : "content",
          position: index + 1,
        }),
      );
    });

  return records;
}

async function mapConcurrent(items, worker, limit) {
  const results = [];
  let next = 0;

  async function run() {
    while (next < items.length) {
      const current = next;
      next += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  console.log(
    sourceDir
      ? `Reading local sitemap: ${path.join(sourceDir, "sitemap.xml")}`
      : `Reading sitemap: ${sitemapUrl}`,
  );
  const sitemap = await readSitemap();
  const urls = extractUrlsFromSitemap(sitemap);

  console.log(`Indexing ${urls.length} URL(s) into ${indexName}`);

  const pageRecords = await mapConcurrent(
    urls,
    async (url, index) => {
      try {
        const html = await readPageHtml(url);
        const records = extractRecords(url, html);
        console.log(`${index + 1}/${urls.length} ${records.length} ${url}`);
        return records;
      } catch (error) {
        console.warn(
          `${index + 1}/${urls.length} skipped ${url}: ${error.message}`,
        );
        return [];
      }
    },
    concurrency,
  );

  const records = pageRecords.flat();
  console.log(`Extracted ${records.length} record(s)`);

  if (records.length === 0) {
    throw new Error("No records extracted; aborting Algolia update.");
  }

  await algoliaRequest(`/1/indexes/${encodeURIComponent(indexName)}/clear`, {});

  await algoliaRequest(
    `/1/indexes/${encodeURIComponent(indexName)}/settings`,
    {
      attributesForFaceting: ["type", "lang", "language", "version", "tags"],
      attributesToRetrieve: [
        "hierarchy",
        "content",
        "anchor",
        "url",
        "url_without_anchor",
        "type",
      ],
      attributesToHighlight: ["hierarchy", "content"],
      attributesToSnippet: ["content:10"],
      searchableAttributes: [
        "unordered(hierarchy.lvl0)",
        "unordered(hierarchy.lvl1)",
        "unordered(hierarchy.lvl2)",
        "unordered(hierarchy.lvl3)",
        "unordered(hierarchy.lvl4)",
        "unordered(hierarchy.lvl5)",
        "unordered(hierarchy.lvl6)",
        "content",
      ],
      distinct: true,
      attributeForDistinct: "url",
      customRanking: [
        "desc(weight.pageRank)",
        "desc(weight.level)",
        "asc(weight.position)",
      ],
      ranking: [
        "words",
        "filters",
        "typo",
        "attribute",
        "proximity",
        "exact",
        "custom",
      ],
      highlightPreTag: '<span class="algolia-docsearch-suggestion--highlight">',
      highlightPostTag: "</span>",
      minWordSizefor1Typo: 3,
      minWordSizefor2Typos: 7,
      allowTyposOnNumericTokens: false,
      minProximity: 1,
      ignorePlurals: true,
      advancedSyntax: true,
      removeWordsIfNoResults: "allOptional",
    },
    "PUT",
  );

  for (let i = 0; i < records.length; i += 1000) {
    const chunk = records.slice(i, i + 1000);
    await algoliaRequest(`/1/indexes/${encodeURIComponent(indexName)}/batch`, {
      requests: chunk.map((body) => ({
        action: "addObject",
        body,
      })),
    });
    console.log(
      `Uploaded ${Math.min(i + chunk.length, records.length)}/${records.length}`,
    );
  }

  console.log("DocSearch index update completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
