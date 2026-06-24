interface ZipEntry {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

interface XlsxRow {
  municipality: string;
  category: string;
  name: string;
  streetAddress: string;
}

const REQUIRED_INPUT_COUNT = 5;
const REGIONAL_INPUT_COUNT = 4;
const ZIP_END_RECORD_MINIMUM_SIZE = 22;
const ZIP_END_RECORD_MAXIMUM_SEARCH = 65_557;
const ZIP_END_RECORD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_COMPRESSION_STORED = 0;
const ZIP_COMPRESSION_DEFLATE = 8;
const XLSX_SHARED_STRINGS_PATH = "xl/sharedStrings.xml";
const XLSX_WORKSHEET_PATH = "xl/worksheets/sheet1.xml";
const OUTPUT_PATH = "../public/data/stores.json";
const UNMATCHED_PREVIEW_COUNT = 10;

const DEFAULT_INPUTS = [
  "/mnt/d/downloads/取扱店舗一覧（道北）.md",
  "/mnt/d/downloads/取扱店舗一覧（道南）.md",
  "/mnt/d/downloads/取扱店舗一覧（道央）.md",
  "/mnt/d/downloads/取扱店舗一覧（道東）.md",
  "/mnt/d/downloads/取扱店舗一覧（全道）.xlsx",
] as const;

const REGIONS = ["道北", "道南", "道央", "道東"] as const;
type Region = (typeof REGIONS)[number];

const decoder = new TextDecoder();

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function parseZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  let endOffset = -1;
  for (
    let offset = bytes.length - ZIP_END_RECORD_MINIMUM_SIZE;
    offset >= Math.max(0, bytes.length - ZIP_END_RECORD_MAXIMUM_SEARCH);
    offset--
  ) {
    if (readUint32(bytes, offset) === ZIP_END_RECORD_SIGNATURE) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    throw new Error("ZIP end-of-central-directory record was not found");
  }

  const entryCount = readUint16(bytes, endOffset + 10);
  let offset = readUint32(bytes, endOffset + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index++) {
    if (readUint32(bytes, offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid ZIP central directory at ${offset}`);
    }
    const fileNameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const name = decoder.decode(
      bytes.subarray(offset + 46, offset + 46 + fileNameLength),
    );
    entries.set(name, {
      compressionMethod: readUint16(bytes, offset + 10),
      compressedSize: readUint32(bytes, offset + 20),
      localHeaderOffset: readUint32(bytes, offset + 42),
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipText(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
): Promise<string> {
  const entry = entries.get(name);
  if (!entry) throw new Error(`ZIP entry not found: ${name}`);
  const offset = entry.localHeaderOffset;
  if (readUint32(bytes, offset) !== ZIP_LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Invalid local ZIP header for ${name}`);
  }
  const fileNameLength = readUint16(bytes, offset + 26);
  const extraLength = readUint16(bytes, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = bytes.subarray(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.compressionMethod === ZIP_COMPRESSION_STORED) {
    return decoder.decode(compressed);
  }
  if (entry.compressionMethod !== ZIP_COMPRESSION_DEFLATE) {
    throw new Error(
      `Unsupported ZIP compression method ${entry.compressionMethod}`,
    );
  }

  const compressedCopy = new Uint8Array(compressed.byteLength);
  compressedCopy.set(compressed);
  const stream = new Blob([compressedCopy.buffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return decoder.decode(await new Response(stream).arrayBuffer());
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replace(
      /&#(\d+);/g,
      (_, code: string) => String.fromCodePoint(Number(code)),
    )
    .replace(
      /&#x([\da-f]+);/gi,
      (_, code: string) => String.fromCodePoint(parseInt(code, 16)),
    );
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join("")
  );
}

function parseSheetRows(xml: string, sharedStrings: string[]): XlsxRow[] {
  const result: XlsxRow[] = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const cells = new Map<string, string>();
    for (
      const cellMatch of rowMatch[1].matchAll(
        /<c\s+([^>]*)>([\s\S]*?)<\/c>/g,
      )
    ) {
      const attributes = cellMatch[1];
      const reference = /\br="([A-Z]+)\d+"/.exec(attributes)?.[1];
      if (!reference) continue;
      const rawValue = /<v>([\s\S]*?)<\/v>/.exec(cellMatch[2])?.[1] ?? "";
      const value = /\bt="s"/.test(attributes)
        ? sharedStrings[Number(rawValue)] ?? ""
        : decodeXml(rawValue);
      cells.set(reference, value);
    }
    const municipality = cells.get("A")?.trim() ?? "";
    const category = cells.get("B")?.trim() ?? "";
    const name = cells.get("C")?.trim() ?? "";
    const streetAddress = cells.get("D")?.trim() ?? "";
    if (
      municipality.startsWith("北海道") &&
      category &&
      !category.startsWith("店舗業種") &&
      name &&
      streetAddress
    ) {
      result.push({ municipality, category, name, streetAddress });
    }
  }
  return result;
}

function normalizeLine(value: string): string {
  return value.normalize("NFKC").replace(/[〜～]/g, "~").replace(/\s+/g, "");
}

function cleanMarkdownStoreLine(value: string): string {
  const repeatedHeader = value.indexOf("道民生活応援ポイント", 1);
  return repeatedHeader > 0 ? value.slice(0, repeatedHeader) : value;
}

function hashId(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function sourceDate(markdown: string): string {
  const fullWidth = /（([０-９]{4})年([０-９]{1,2})月([０-９]{1,2})日）/.exec(
    markdown,
  );
  if (!fullWidth) return "";
  const digits = (value: string) => value.normalize("NFKC").padStart(2, "0");
  return `${digits(fullWidth[1])}-${digits(fullWidth[2])}-${
    digits(fullWidth[3])
  }`;
}

async function main() {
  const inputs = Deno.args.length >= REQUIRED_INPUT_COUNT
    ? Deno.args.slice(0, REQUIRED_INPUT_COUNT)
    : [...DEFAULT_INPUTS];
  const markdownPaths = inputs.slice(0, REGIONAL_INPUT_COUNT);
  const xlsxPath = inputs[REGIONAL_INPUT_COUNT];
  const outputPath = new URL(OUTPUT_PATH, import.meta.url);

  const markdownFiles = await Promise.all(
    markdownPaths.map((path) => Deno.readTextFile(path)),
  );
  const lineRegions = new Map<string, Region>();
  const dates = {} as Record<Region, string>;

  markdownFiles.forEach((markdown, index) => {
    const region = REGIONS[index];
    dates[region] = sourceDate(markdown);
    for (const line of markdown.split(/\r?\n/)) {
      if (!line.startsWith("北海道")) continue;
      lineRegions.set(normalizeLine(cleanMarkdownStoreLine(line)), region);
    }
  });

  const xlsxBytes = await Deno.readFile(xlsxPath);
  const zipEntries = parseZipEntries(xlsxBytes);
  const sharedStrings = parseSharedStrings(
    await readZipText(xlsxBytes, zipEntries, XLSX_SHARED_STRINGS_PATH),
  );
  const rows = parseSheetRows(
    await readZipText(xlsxBytes, zipEntries, XLSX_WORKSHEET_PATH),
    sharedStrings,
  );

  const unmatched: XlsxRow[] = [];
  const stores = rows.flatMap((row) => {
    const reconstructed =
      `${row.municipality} ${row.category} ${row.name} ${row.streetAddress}`;
    const region = lineRegions.get(normalizeLine(reconstructed));
    if (!region) {
      unmatched.push(row);
      return [];
    }
    const address = `${row.municipality}${row.streetAddress}`;
    return [{
      id: `${region}-${hashId(reconstructed)}`,
      region,
      municipality: row.municipality,
      category: row.category,
      name: row.name.replaceAll("\u3000", " "),
      streetAddress: row.streetAddress.replaceAll("\u3000", " "),
      address: address.replaceAll("\u3000", " "),
    }];
  });

  if (unmatched.length > 0) {
    console.warn(
      `${unmatched.length} Excel rows were not present verbatim in the regional Markdown files.`,
    );
    console.warn(unmatched.slice(0, UNMATCHED_PREVIEW_COUNT));
  }

  const counts = Object.fromEntries(
    REGIONS.map((
      region,
    ) => [region, stores.filter((store) => store.region === region).length]),
  );
  const dataset = {
    title: "道民生活応援ポイント（どうみんポイント）取扱店舗",
    generatedAt: new Date().toISOString(),
    sourceDates: dates,
    count: stores.length,
    stores,
  };

  await Deno.mkdir(new URL("../public/data", import.meta.url), {
    recursive: true,
  });
  await Deno.writeTextFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);

  console.log(`Generated ${stores.length} stores at ${outputPath.pathname}`);
  console.log(counts);
}

if (import.meta.main) await main();
