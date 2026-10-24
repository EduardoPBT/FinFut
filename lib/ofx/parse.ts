export type ParsedOfxTxn = {
  fitId: string | null;
  occurredOn: string;
  amountCents: number;
  trnType: string;
  name: string;
  memo: string;
  description: string;
};

export type ParsedOfx = {
  accountHint: "conta" | "cartao" | "desconhecido";
  transactions: ParsedOfxTxn[];
};

const DEBIT_TYPES = new Set([
  "DEBIT",
  "FEE",
  "SRVCHG",
  "ATM",
  "POS",
  "CHECK",
  "PAYMENT",
  "DIRECTDEBIT",
  "REPEATPMT",
]);

const CREDIT_TYPES = new Set(["CREDIT", "DEP", "INT", "DIV", "DIRECTDEP"]);

export function decodeOfxBytes(bytes: Uint8Array): string {
  const header = new TextDecoder("ascii", { fatal: false }).decode(bytes.subarray(0, 800));
  const charset = `${header.match(/CHARSET:\s*(\S+)/i)?.[1] ?? ""} ${header.match(/ENCODING:\s*(\S+)/i)?.[1] ?? ""}`;
  if (/utf-?8|unicode/i.test(charset)) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  return new TextDecoder("windows-1252").decode(bytes);
}

function ofxField(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>\\s*([^\\n<]*)`, "i"));
  return match?.[1]?.trim() || null;
}

export function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseOfxAmountToCents(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return null;
  const value =
    cleaned.includes(",") && !cleaned.includes(".")
      ? Number(cleaned.replace(",", "."))
      : Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function signedAmountCents(amountCents: number, trnType: string) {
  if (amountCents < 0) return amountCents;
  const type = trnType.toUpperCase();
  if (DEBIT_TYPES.has(type)) return -Math.abs(amountCents);
  if (CREDIT_TYPES.has(type)) return Math.abs(amountCents);
  return amountCents;
}

function cleanDescription(name: string, memo: string) {
  const parts = [name, memo]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length === 0) return "Lançamento OFX";
  if (parts.length === 2 && parts[1].toLowerCase() === parts[0].toLowerCase()) {
    return parts[0];
  }
  return parts.join(" · ").slice(0, 200);
}

function detectAccountHint(text: string): ParsedOfx["accountHint"] {
  if (/CREDITCARDMSGSRSV1|<CCSTMTRS|<CCACCTFROM/i.test(text)) return "cartao";
  if (/BANKMSGSRSV1|<STMTRS|<BANKACCTFROM/i.test(text)) return "conta";
  return "desconhecido";
}

function extractBlocks(text: string) {
  const blocks: string[] = [];
  const regex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/(?:BANKTRANLIST|CCSTMTRS|STMTRS)>))/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    blocks.push(match[1]);
  }
  return blocks;
}

export function parseOfxText(text: string): ParsedOfx {
  const looksLikeOfx = /<OFX|OFXHEADER|<STMTTRN/i.test(text);
  if (!looksLikeOfx) {
    throw new Error("Não consegui ler este arquivo como OFX.");
  }

  const transactions: ParsedOfxTxn[] = [];
  for (const block of extractBlocks(text)) {
    const occurredOn = parseOfxDate(ofxField(block, "DTPOSTED") ?? ofxField(block, "DTUSER"));
    const amountCents = parseOfxAmountToCents(ofxField(block, "TRNAMT"));
    if (!occurredOn || amountCents === null) continue;

    const trnType = (ofxField(block, "TRNTYPE") ?? "OTHER").toUpperCase();
    const name = ofxField(block, "NAME") ?? "";
    const memo = ofxField(block, "MEMO") ?? "";
    transactions.push({
      fitId: ofxField(block, "FITID"),
      occurredOn,
      amountCents: signedAmountCents(amountCents, trnType),
      trnType,
      name,
      memo,
      description: cleanDescription(name, memo),
    });
  }

  if (transactions.length === 0) {
    throw new Error("Nenhuma movimentação encontrada neste OFX.");
  }

  return {
    accountHint: detectAccountHint(text),
    transactions,
  };
}

export function parseOfxBytes(bytes: Uint8Array): ParsedOfx {
  return parseOfxText(decodeOfxBytes(bytes));
}
