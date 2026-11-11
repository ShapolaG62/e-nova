// ZIP mínimo (sem compressão) para baixar o site — sem dependências.
const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// arquivos: [{ nome: 'index.html', dados: Buffer|string }]
function zip(arquivos) {
  const partes = [], central = [];
  let offset = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, 'utf8');
    const dados = Buffer.isBuffer(a.dados) ? a.dados : Buffer.from(String(a.dados), 'utf8');
    const crc = crc32(dados);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(0, 8);
    loc.writeUInt32LE(0, 10); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(dados.length, 18); loc.writeUInt32LE(dados.length, 22);
    loc.writeUInt16LE(nome.length, 26); loc.writeUInt16LE(0, 28);
    partes.push(loc, nome, dados);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(dados.length, 20); cen.writeUInt32LE(dados.length, 24);
    cen.writeUInt16LE(nome.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nome);
    offset += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamCentral, 12); fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, ...central, fim]);
}

export { zip };
