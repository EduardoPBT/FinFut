import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeOfxBytes, parseOfxBytes, parseOfxText } from "./parse.ts";
import { prepareOfxLines, resolveFitId } from "./prepare.ts";
import type { Category } from "@/lib/types";

const categories: Category[] = [
  { id: "r1", household_id: "h", name: "Salário", kind: "receita", icon: "x", color: "#000", sort_order: 1 },
  { id: "d1", household_id: "h", name: "Mercado", kind: "variavel", icon: "x", color: "#000", sort_order: 2 },
  { id: "d2", household_id: "h", name: "Outros", kind: "variavel", icon: "x", color: "#000", sort_order: 3 },
];

function bankOfx(body: string) {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTRS>
<BANKTRANLIST>
${body}
</BANKTRANLIST>
</STMTRS>
</BANKMSGSRSV1>
</OFX>
`;
}

function cardOfx(body: string) {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTRS>
<BANKTRANLIST>
${body}
</BANKTRANLIST>
</CCSTMTRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;
}

test("lê extrato SGML sem tags de fechamento", () => {
  const parsed = parseOfxText(
    bankOfx(`<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260315120000[-3:BRT]
<TRNAMT>-45.90
<FITID>DEB-1
<NAME>PADARIA CENTRAL
<MEMO>COMPRA DEBITO
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260305
<TRNAMT>3200.00
<FITID>CRED-1
<NAME>SALARIO
`),
  );

  assert.equal(parsed.accountHint, "conta");
  assert.equal(parsed.transactions.length, 2);
  assert.equal(parsed.transactions[0].occurredOn, "2026-03-15");
  assert.equal(parsed.transactions[0].amountCents, -4590);
  assert.equal(parsed.transactions[0].description, "PADARIA CENTRAL · COMPRA DEBITO");
  assert.equal(parsed.transactions[1].amountCents, 320000);
});

test("lê fatura de cartão e identifica compras e pagamento", () => {
  const parsed = parseOfxText(
    cardOfx(`<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310
<TRNAMT>-87.50
<FITID>CARD-1
<NAME>SUPERMERCADO BOM
</STMTTRN>
<STMTTRN>
<TRNTYPE>PAYMENT
<DTPOSTED>20260312
<TRNAMT>450.00
<FITID>CARD-PAY
<NAME>PAGAMENTO FATURA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260318
<TRNAMT>20.00
<FITID>CARD-REF
<MEMO>ESTORNO IFOOD
</STMTTRN>
`),
  );

  assert.equal(parsed.accountHint, "cartao");
  const lines = prepareOfxLines("fatura", parsed.transactions, categories, new Set());
  assert.equal(lines[0].decision, "import");
  assert.equal(lines[0].amountCents, 8750);
  assert.equal(lines[0].categoryName, "Mercado");
  assert.equal(lines[1].decision, "skip_payment");
  assert.equal(lines[2].decision, "skip_refund");
});

test("decodifica acentos em Windows-1252", () => {
  const header = Buffer.from(
    "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nENCODING:USASCII\nCHARSET:1252\n\n<OFX>\n<BANKMSGSRSV1>\n<STMTRS>\n<BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20260320\n<TRNAMT>-12.50\n<FITID>ACCENT-1\n<NAME>",
    "ascii",
  );
  const name = Buffer.from([0x50, 0x61, 0x64, 0x61, 0x72, 0x69, 0x61, 0x20, 0x53, 0xe3, 0x6f, 0x20, 0x4a, 0x6f, 0x73, 0xe9]);
  const tail = Buffer.from("\n</BANKTRANLIST>\n</STMTRS>\n</BANKMSGSRSV1>\n</OFX>\n", "ascii");
  const bytes = new Uint8Array(Buffer.concat([header, name, tail]));

  const text = decodeOfxBytes(bytes);
  assert.match(text, /Padaria São José/);

  const parsed = parseOfxBytes(bytes);
  assert.equal(parsed.transactions[0].description, "Padaria São José");
});

test("sem FITID gera hash estável de data, valor e descrição", () => {
  const parsed = parseOfxText(
    bankOfx(`<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260301
<TRNAMT>-10.00
<NAME>PADARIA
`),
  );
  const first = resolveFitId(parsed.transactions[0]);
  const second = resolveFitId(parsed.transactions[0]);
  assert.match(first, /^hash:[0-9a-f]{32}$/);
  assert.equal(first, second);
});

test("pagamento de fatura no extrato entra como transferência", () => {
  const parsed = parseOfxText(
    bankOfx(`<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260308
<TRNAMT>-890.00
<FITID>BILL-1
<NAME>PAGAMENTO FATURA NUBANK
`),
  );
  const [line] = prepareOfxLines("extrato", parsed.transactions, categories, new Set());
  assert.equal(line.decision, "import");
  assert.equal(line.movementKind, "transferencia");
  assert.equal(line.categoryId, null);
});

test("fatura sem sinal trata CREDIT positivo como compra", () => {
  const parsed = parseOfxText(
    cardOfx(`<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260310
<TRNAMT>54.90
<FITID>POS-1
<NAME>MERCADO LIVRE
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260311
<TRNAMT>20.00
<FITID>POS-REF
<MEMO>ESTORNO IFOOD
`),
  );
  const lines = prepareOfxLines("fatura", parsed.transactions, categories, new Set());
  assert.equal(lines[0].decision, "import");
  assert.equal(lines[0].amountCents, 5490);
  assert.equal(lines[1].decision, "skip_refund");
});

test("FITID já visto vira duplicata", () => {
  const parsed = parseOfxText(
    bankOfx(`<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260301
<TRNAMT>-10.00
<FITID>DUP-1
<NAME>MERCADO
`),
  );
  const [line] = prepareOfxLines("extrato", parsed.transactions, categories, new Set(["DUP-1"]));
  assert.equal(line.decision, "duplicate");
});
