export function run(input) {
  const text = input.text, header = !!input.header, n = text.length;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) i = 1;
  let line = 1;
  let columns = null;
  const rows = [], errors = [];
  let width = -1, first = true;
  const countLF = (a, b) => {
    let c = 0, p = a;
    while (true) { p = text.indexOf('\n', p); if (p === -1 || p >= b) break; c++; p++; }
    return c;
  };
  const normSeg = (a, b) => {
    let out = '', p = a;
    while (true) {
      const r = text.indexOf('\r', p);
      if (r === -1 || r >= b) { line += countLF(p, b); return out + text.slice(p, b); }
      line += countLF(p, r);
      out += text.slice(p, r);
      if (text.charCodeAt(r + 1) === 10) { out += '\n'; line++; p = r + 2; }
      else { out += '\n'; line++; p = r + 1; }
    }
  };
  function endRecord(fields, recLine, rowIdx) {
    if (first) {
      width = fields.length;
      if (header) columns = fields; else rows.push(fields);
      first = false;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: rowIdx, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recLine, row: rowIdx, extra: fields.slice(width) });
      fields.length = width;
    }
    rows.push(fields);
  }
  let cur = '';
  const parseField = (recLine, rowIdx) => {
    if (i < n && text.charCodeAt(i) === 34) {
      let val = '', j = i + 1;
      while (true) {
        const k = text.indexOf('"', j);
        if (k === -1) {
          errors.push({ code: 'unterminated_quote', line: recLine, row: rowIdx });
          cur = '"';
          i = i + 1;
          return parseUnquoted('"', recLine, rowIdx);
        }
        if (text.charCodeAt(k + 1) === 34) {
          val += normSeg(j, k) + '"';
          j = k + 2;
          continue;
        }
        val += normSeg(j, k);
        let m = k + 1, js = m, parts = null;
        while (m < n) {
          const c = text.charCodeAt(m);
          if (c === 44) {
            const junk = parts ? parts.join('') + text.slice(js, m) : text.slice(js, m);
            if (junk.length) errors.push({ code: 'quote_junk', line: recLine, row: rowIdx });
            cur = val + junk; i = m + 1;
            return 0;
          }
          if (c === 10) {
            const junk = parts ? parts.join('') + text.slice(js, m) : text.slice(js, m);
            if (junk.length) errors.push({ code: 'quote_junk', line: recLine, row: rowIdx });
            cur = val + junk; i = m + 1; line++;
            return 1;
          }
          if (c === 13) {
            if (text.charCodeAt(m + 1) === 10) {
              const junk = parts ? parts.join('') + text.slice(js, m) : text.slice(js, m);
              if (junk.length) errors.push({ code: 'quote_junk', line: recLine, row: rowIdx });
              cur = val + junk; i = m + 2; line++;
              return 1;
            }
            errors.push({ code: 'stray_cr', line: recLine, row: rowIdx });
            if (!parts) parts = [];
            parts.push(text.slice(js, m));
            m++; js = m;
            continue;
          }
          m++;
        }
        const junk = parts ? parts.join('') + text.slice(js, m) : text.slice(js, m);
        if (junk.length) errors.push({ code: 'quote_junk', line: recLine, row: rowIdx });
        cur = val + junk; i = n;
        return 2;
      }
    }
    return parseUnquoted('', recLine, rowIdx);
  };
  const parseUnquoted = (prefix, recLine, rowIdx) => {
    let val = prefix, p = i;
    while (true) {
      const c = text.indexOf(',', p);
      const lf = text.indexOf('\n', p);
      const cr = text.indexOf('\r', p);
      let m = -1, kind = 0;
      if (c !== -1) { m = c; kind = 0; }
      if (lf !== -1 && (m === -1 || lf < m)) { m = lf; kind = 1; }
      if (cr !== -1 && (m === -1 || cr < m)) { m = cr; kind = 2; }
      if (m === -1) { val += text.slice(p); cur = val; i = n; return 2; }
      if (kind === 0) { val += text.slice(p, m); cur = val; i = m + 1; return 0; }
      if (kind === 1) { val += text.slice(p, m); cur = val; i = m + 1; line++; return 1; }
      if (text.charCodeAt(m + 1) === 10) {
        val += text.slice(p, m); cur = val; i = m + 2; line++; return 1;
      }
      errors.push({ code: 'stray_cr', line: recLine, row: rowIdx });
      val += text.slice(p, m);
      p = m + 1;
    }
  };
  while (i < n) {
    const recLine = line;
    const rowIdx = (first && header) ? null : rows.length;
    const nl = text.indexOf('\n', i);
    const end = nl === -1 ? n : nl;
    const q = text.indexOf('"', i);
    if (q === -1 || q >= end) {
      const r = text.indexOf('\r', i);
      if ((r === -1 || r >= end || (nl !== -1 && r === end - 1))) {
        let lineEnd = end;
        if (r === end - 1) lineEnd = end - 1;
        if (lineEnd === i) { i = nl === -1 ? n : nl + 1; line++; continue; }
        const fields = text.slice(i, lineEnd).split(',');
        i = nl === -1 ? n : nl + 1;
        line++;
        endRecord(fields, recLine, rowIdx);
        continue;
      }
    }
    const fields = [];
    let how = 0;
    while (true) {
      how = parseField(recLine, rowIdx);
      fields.push(cur);
      if (how !== 0) break;
    }
    endRecord(fields, recLine, rowIdx);
    if (how === 2) break;
  }
  return { columns, rows, errors };
}
