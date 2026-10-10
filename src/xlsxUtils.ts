export interface XlsxCell {
  value: string;
}

export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function writeU32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function zipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach(entry => {
    const name = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = concatBytes([
      writeU32(0x04034b50),
      writeU16(20),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(crc),
      writeU32(data.length),
      writeU32(data.length),
      writeU16(name.length),
      writeU16(0),
      name
    ]);

    localParts.push(localHeader, data);

    const centralHeader = concatBytes([
      writeU32(0x02014b50),
      writeU16(20),
      writeU16(20),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(crc),
      writeU32(data.length),
      writeU32(data.length),
      writeU16(name.length),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(0),
      writeU32(offset),
      name
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const localData = concatBytes(localParts);
  const centralData = concatBytes(centralParts);
  const end = concatBytes([
    writeU32(0x06054b50),
    writeU16(0),
    writeU16(0),
    writeU16(entries.length),
    writeU16(entries.length),
    writeU32(centralData.length),
    writeU32(localData.length),
    writeU16(0)
  ]);

  return concatBytes([localData, centralData, end]);
}

function buildSheetXml(rows: XlsxCell[][]): string {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const value = String(cell?.value ?? '');
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function buildWorkbookXml(sheets: XlsxSheet[]): string {
  const sheetXml = sheets.map((sheet, index) =>
    `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetXml}</sheets>
</workbook>`;
}

function buildWorkbookRels(sheets: XlsxSheet[]): string {
  const rels = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function buildContentTypes(sheets: XlsxSheet[]): string {
  const overrides = [
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    ...sheets.map((_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides}
</Types>`;
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

export function createXlsxBlob(sheets: XlsxSheet[]): Blob {
  const safeSheets = sheets.map((sheet, index) => ({
    name: sheet.name || `Planilha ${index + 1}`,
    rows: sheet.rows
  }));

  const entries = [
    { name: '[Content_Types].xml', data: encoder.encode(buildContentTypes(safeSheets)) },
    { name: '_rels/.rels', data: encoder.encode(buildRootRels()) },
    { name: 'xl/workbook.xml', data: encoder.encode(buildWorkbookXml(safeSheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(buildWorkbookRels(safeSheets)) },
    ...safeSheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(buildSheetXml(sheet.rows))
    }))
  ];

  return new Blob([zipStore(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

interface ZipEntry {
  name: string;
  method: number;
  data: Uint8Array;
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece suporte à leitura de arquivos Excel compactados.');
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function unzipEntries(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  // Read entries from the ZIP central directory. Excel/LibreOffice files often
  // use data descriptors, so local-header sizes may be zero and cannot be used
  // to find the next entry reliably.
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries: ZipEntry[] = [];
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 22 - 0xffff);

  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (offset >= 0 && readU32(view, offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Arquivo Excel inválido: diretório ZIP não encontrado.');

  const entryCount = readU16(view, eocdOffset + 10);
  let offset = readU32(view, eocdOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || readU32(view, offset) !== 0x02014b50) {
      throw new Error('Arquivo Excel inválido: diretório ZIP inconsistente.');
    }
    const method = readU16(view, offset + 10);
    const compressedSize = readU32(view, offset + 20);
    const nameLength = readU16(view, offset + 28);
    const extraLength = readU16(view, offset + 30);
    const commentLength = readU16(view, offset + 32);
    const localOffset = readU32(view, offset + 42);
    const nameStart = offset + 46;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength)).replace(/^\uFEFF/, '');

    if (localOffset + 30 > bytes.length || readU32(view, localOffset) !== 0x04034b50) {
      throw new Error('Arquivo Excel inválido: cabeçalho de arquivo ausente.');
    }
    const localNameLength = readU16(view, localOffset + 26);
    const localExtraLength = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error('Arquivo Excel truncado.');
    const compressed = bytes.slice(dataStart, dataEnd);

    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error(`Formato de compactação do Excel não suportado: ${method}.`);

    entries.push({ name, method, data });
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  if (!entries.length) throw new Error('Nenhuma planilha Excel foi encontrada.');
  return entries;
}

function decodeXmlText(value: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function getXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1] || '';
}

function getAttr(tag: string, attr: string): string {
  const match = tag.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];
  const matches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi);
  for (const match of matches) {
    const texts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi))
      .map(item => decodeXmlText(item[1]));
    values.push(texts.join(''));
  }
  return values;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi);

  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi);

    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = getAttr(attrs, 'r');
      const colMatch = ref.match(/^([A-Z]+)/i);
      if (!colMatch) continue;

      let column = 0;
      for (const char of colMatch[1].toUpperCase()) {
        column = column * 26 + (char.charCodeAt(0) - 64);
      }
      column -= 1;

      while (cells.length <= column) cells.push('');

      const type = getAttr(attrs, 't');
      if (type === 'inlineStr') {
        const text = Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi))
          .map(item => decodeXmlText(item[1]))
          .join('');
        cells[column] = text;
      } else if (type === 's') {
        const value = getXmlTag(body, 'v');
        const index = Number(value);
        cells[column] = Number.isInteger(index) ? (sharedStrings[index] || '') : '';
      } else {
        cells[column] = decodeXmlText(getXmlTag(body, 'v'));
      }
    }

    rows.push(cells);
  }

  return rows;
}

export async function readFirstSheetXlsx(file: File): Promise<string[][]> {
  const entries = await unzipEntries(await file.arrayBuffer());
  const workbookEntry = entries.find(entry => entry.name === 'xl/workbook.xml');
  const relsEntry = entries.find(entry => entry.name === 'xl/_rels/workbook.xml.rels');

  if (!workbookEntry || !relsEntry) {
    throw new Error('Arquivo Excel inválido: estrutura da pasta de trabalho não encontrada.');
  }

  const workbookXml = decoder.decode(workbookEntry.data);
  const relsXml = decoder.decode(relsEntry.data);

  const firstSheetTag = workbookXml.match(/<sheet\b[^>]*\/>/i)?.[0];
  if (!firstSheetTag) throw new Error('O arquivo Excel não possui uma planilha.');

  const relationshipId = getAttr(firstSheetTag, 'r:id');
  const relationship = relsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${relationshipId}"[^>]*/>`, 'i'))?.[0];
  if (!relationship) throw new Error('Não foi possível localizar a primeira planilha do Excel.');

  const target = getAttr(relationship, 'Target').replace(/^\/+/, '');
  const sheetPath = target.startsWith('xl/') ? target : `xl/${target}`;
  const sheetEntry = entries.find(entry => entry.name === sheetPath);
  if (!sheetEntry) throw new Error('A primeira planilha do Excel não foi encontrada.');

  const sharedEntry = entries.find(entry => entry.name === 'xl/sharedStrings.xml');
  const sharedStrings = sharedEntry
    ? parseSharedStrings(decoder.decode(sharedEntry.data))
    : [];

  return parseSheetRows(decoder.decode(sheetEntry.data), sharedStrings);
}
