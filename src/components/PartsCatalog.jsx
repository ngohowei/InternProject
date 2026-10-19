import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PART_CATEGORIES } from '../data/partCategories';
import { Package, Search, Plus, Pencil, Trash2, Power, PowerOff, Upload, Download, FileText } from 'lucide-react';

const MAX_IMPORT_ROWS = 2000;

// Small CSV reader (handles quotes, commas and line breaks inside quotes, Excel's BOM).
// Each row remembers the line it started on so error messages can point at the right line.
const parseCsv = (text) => {
  const s = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;

  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some((c) => c.trim() !== '')) rows.push({ cells: row, line: rowLine });
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += c;
    }
  }
  endRow();
  return rows;
};

const HEADER_NAMES = {
  code: ['code', 'item code', 'itemcode', 'part code', 'part number', 'sku'],
  name: ['name', 'item name', 'itemname', 'part name', 'description', 'item'],
  unitPrice: ['unitprice', 'unit price', 'unit_price', 'price', 'cost'],
  category: ['category', 'type', 'group']
};

// Turn the CSV text into import rows, or explain what is wrong with the file.
const csvToItems = (text) => {
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: 'The file needs a header row and at least one item.' };

  const header = rows[0].cells.map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(HEADER_NAMES)) {
    col[key] = header.findIndex((h) => names.includes(h));
  }
  if (col.code < 0 || col.name < 0 || col.unitPrice < 0) {
    return { error: 'The first row must have the column names: code, name, unitPrice (and optionally category).' };
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return { error: `That file has ${rows.length - 1} items. The limit is ${MAX_IMPORT_ROWS} per import, so please split it.` };
  }

  const items = rows.slice(1).map((r) => ({
    row: r.line,
    code: r.cells[col.code] ?? '',
    name: r.cells[col.name] ?? '',
    unitPrice: r.cells[col.unitPrice] ?? '',
    category: col.category >= 0 ? (r.cells[col.category] ?? '') : ''
  }));
  return { items };
};

// Save text as a file download (a Blob, so large catalogs are fine). The BOM makes Excel / WPS
// read the file as UTF-8.
const saveTextFile = (text, filename) => {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Quote a value for CSV when it contains a comma, quote or line break.
const csvCell = (v) => {
  const t = String(v ?? '');
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

// A blank example of the format. The rows are obvious placeholders: this is NOT your catalog
// (use "Export CSV" to get your real items).
const downloadTemplate = () => {
  const csv = [
    'code,name,unitPrice,category',
    'EXAMPLE-001,Example item - replace or delete this row,10.00,General',
    'EXAMPLE-002,Another example item - replace or delete this row,25.50,Electrical'
  ].join('\n');
  saveTextFile(csv, 'parts-catalog-template.csv');
};

const emptyForm = { id: null, code: '', name: '', category: 'General', unitPrice: '' };

export const PartsCatalog = () => {
  const { fetchParts, savePart, deletePart, importParts, showNotification } = useApp();

  // What the admin is looking at: filters, sort order and page. The server does the filtering,
  // so this stays fast however many items the company has.
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState({ field: 'code', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  const [list, setList] = useState({ parts: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(null); // add / edit dialog
  const [importState, setImportState] = useState(null); // CSV preview dialog
  const fileRef = useRef(null);

  const reload = () => setReloadKey((k) => k + 1);

  // Download the WHOLE catalog (every item, hidden ones too), not just the page on screen.
  // It uses the same columns as "Import CSV", so it can be edited in Excel and imported back.
  const [exporting, setExporting] = useState(false);
  const exportCatalog = async () => {
    setExporting(true);
    try {
      const rows = [];
      for (let pageNo = 1; pageNo <= 200; pageNo++) { // up to 200 x 100 = 20,000 items
        const data = await fetchParts({ sort: 'code', dir: 'asc', page: pageNo, limit: 100 });
        if (!data?.success) {
          showNotification(data?.error || 'Could not export the catalog.', 'error');
          return;
        }
        rows.push(...data.parts);
        if (pageNo >= data.pages) break;
      }
      const csv = [
        'code,name,unitPrice,category',
        ...rows.map((p) => [p.code, p.name, p.unitPrice.toFixed(2), p.category || 'General'].map(csvCell).join(','))
      ].join('\n');
      saveTextFile(csv, `parts-catalog-${new Date().toISOString().slice(0, 10)}.csv`);
      showNotification(`Exported ${rows.length} item(s) to CSV`);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await fetchParts({ q: query, category, status, sort: sort.field, dir: sort.dir, page, limit: pageSize });
      if (cancelled) return;
      if (data?.success) {
        // e.g. the only item on the last page was just deleted: step back a page
        if (data.parts.length === 0 && page > 1) { setPage(data.pages); return; }
        setList({ parts: data.parts, total: data.total, pages: data.pages });
        setLoadError('');
      } else {
        setLoadError(data?.error || 'Could not load the parts catalog.');
      }
      setLoading(false);
    }, query ? 300 : 0); // wait for the admin to stop typing before searching
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, category, status, sort, page, pageSize, reloadKey, fetchParts]);

  const toggleSort = (field) => {
    setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }));
    setPage(1);
  };
  const renderSortTh = (field, label, align = 'left') => (
    <th
      onClick={() => toggleSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textAlign: align }}
      title="Click to sort"
    >
      {label}{' '}
      {sort.field === field ? (sort.dir === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3 }}>↕</span>}
    </th>
  );

  const hasFilters = query || category !== 'ALL' || status !== 'ALL';
  const clearFilters = () => { setQuery(''); setCategory('ALL'); setStatus('ALL'); setPage(1); };

  const handleSave = async (e) => {
    e.preventDefault();
    const ok = await savePart(
      { code: form.code, name: form.name, category: form.category, unitPrice: Number(form.unitPrice) },
      form.id
    );
    if (ok) { setForm(null); reload(); }
  };

  const handleToggle = async (p) => {
    if (await savePart({ isActive: !p.isActive }, p._id)) reload();
  };

  const handleDelete = async (p) => {
    const sure = window.confirm(
      `Delete ${p.code} - ${p.name}?\n\nWork already logged with this item keeps its price. ` +
      `Engineers just won't be able to pick it any more. (To hide it without deleting, use Hide.)`
    );
    if (sure && (await deletePart(p._id))) reload();
  };

  // ---- CSV import: choose file -> preview what would happen -> confirm ----
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showNotification('That file is larger than 1 MB. Please split it into smaller files.', 'error');
      return;
    }
    const { items, error } = csvToItems(await file.text());
    if (error) { showNotification(error, 'error'); return; }

    setImportState({ fileName: file.name, items, result: null, busy: true });
    const result = await importParts(items, true); // dry run: nothing is saved yet
    if (!result?.success) {
      setImportState(null);
      showNotification(result?.error || 'Could not read that file.', 'error');
      return;
    }
    setImportState({ fileName: file.name, items, result, busy: false });
  };

  const confirmImport = async () => {
    setImportState((s) => ({ ...s, busy: true }));
    const result = await importParts(importState.items, false);
    if (result?.success) {
      showNotification(
        `Import finished: ${result.created} added, ${result.updated} updated` +
        (result.skipped ? `, ${result.skipped} skipped` : '')
      );
      setImportState(null);
      setPage(1);
      reload();
    } else {
      showNotification(result?.error || 'Import failed.', 'error');
      setImportState((s) => ({ ...s, busy: false }));
    }
  };

  const from = list.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, list.total);
  const selectStyle = { width: 'auto' };

  return (
    <>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="card-title">
            <Package className="text-amber" size={20} />
            Parts Catalog
            <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '8px' }}>
              {hasFilters ? `${list.total} matching` : `${list.total} items`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} title="Add or update many items from a CSV file">
              <Upload size={14} /> Import CSV
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={exportCatalog}
              disabled={exporting}
              title="Download ALL your catalog items as a CSV file (edit it in Excel, then Import CSV to apply changes)"
            >
              <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadTemplate}
              title="Download a blank example file showing the columns (it does not contain your items)"
            >
              <FileText size={14} /> Blank template
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...emptyForm })}>
              <Plus size={14} /> Add Item
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          Engineers choose items from this list by name or code and only enter a quantity — the price comes from here.
          Changing a price affects <strong>future work only</strong>; work already logged keeps the price it was logged at.
        </p>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="input"
              placeholder="Search item name or code..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              style={{ paddingLeft: '32px' }}
            />
          </div>
          <select className="select" style={selectStyle} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="ALL">All categories</option>
            {PART_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" style={selectStyle} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All items</option>
            <option value="active">Available only</option>
            <option value="hidden">Hidden only</option>
          </select>
          {hasFilters && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {loadError && (
          <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{loadError}</div>
        )}

        <div className="table-responsive" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <table className="data-table">
            <thead>
              <tr>
                {renderSortTh('code', 'Item Code')}
                {renderSortTh('name', 'Item Name')}
                {renderSortTh('category', 'Category')}
                {renderSortTh('unitPrice', 'Unit Price', 'right')}
                {renderSortTh('status', 'Status')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.parts.map((p) => (
                <tr key={p._id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                  <td className="font-mono text-cyan" style={{ fontWeight: 700 }}>{p.code}</td>
                  <td>{p.name}</td>
                  <td><span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{p.category || 'General'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${p.unitPrice.toFixed(2)}</td>
                  <td>
                    {p.isActive
                      ? <span className="badge status-completed">Available</span>
                      : <span className="badge status-pending" style={{ color: '#ef4444', borderColor: '#ef4444' }}>Hidden</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setForm({ id: p._id, code: p.code, name: p.name, category: p.category || 'General', unitPrice: String(p.unitPrice) })}
                        title="Edit code, name, category or price"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggle(p)}
                        title={p.isActive ? 'Hide from engineers (keeps the item)' : 'Make available to engineers again'}
                      >
                        {p.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                        {p.isActive ? ' Hide' : ' Show'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.5)' }}
                        onClick={() => handleDelete(p)}
                        title="Delete this item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && list.parts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                    {hasFilters
                      ? 'No items match your filters.'
                      : 'No items yet. Click "Add Item", or "Import CSV" to add many at once.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '1rem', fontSize: '0.85rem' }}>
          <span className="text-muted">
            {list.total === 0 ? 'No items' : `Showing ${from}–${to} of ${list.total}`}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Per page
              <select
                className="select"
                style={{ width: 'auto', padding: '4px 8px' }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(1)} title="First page">«</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span>Page {page} of {list.pages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= list.pages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= list.pages} onClick={() => setPage(list.pages)} title="Last page">»</button>
          </div>
        </div>
      </div>

      {/* Add / Edit item */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? 'Edit Catalog Item' : 'Add Catalog Item'}</h3>
              <button className="close-btn" onClick={() => setForm(null)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Item Code</label>
                  <input
                    type="text"
                    className="input font-mono"
                    placeholder="e.g. FUSE-400A"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    maxLength={30}
                    required
                    autoFocus
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Letters, numbers, dot, dash or underscore. Must be unique.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Industrial 400A Semiconductor Fuse (Pack of 3)"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {PART_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      placeholder="0.00"
                      value={form.unitPrice}
                      onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {form.id && (
                  <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', borderLeft: '4px solid #3b82f6', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem' }}>
                    Work already logged keeps its original code, name and price. Changes apply to items added from now on.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{form.id ? 'Save Changes' : 'Add to Catalog'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV import preview */}
      {importState && (
        <div className="modal-overlay" onClick={() => !importState.busy && setImportState(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import Parts from CSV</h3>
              <button className="close-btn" disabled={importState.busy} onClick={() => setImportState(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>{importState.fileName}</strong> &bull; {importState.items.length} rows read
              </div>

              {!importState.result ? (
                <div className="text-muted">Checking the file…</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '1rem' }}>
                    {[
                      ['New items', importState.result.created, '#34d399'],
                      ['Will be updated', importState.result.updated, '#38bdf8'],
                      ['Unchanged', importState.result.unchanged, '#94a3b8'],
                      ['Skipped (errors)', importState.result.skipped, importState.result.skipped ? '#f87171' : '#94a3b8']
                    ].map(([label, n, color]) => (
                      <div key={label} style={{ backgroundColor: 'var(--bg-input)', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{n}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    An item whose code already exists is <strong>updated</strong> with the name, price and category from the file.
                    Hidden items stay hidden. Rows with errors are skipped; everything else is imported.
                  </div>

                  {importState.result.skipped > 0 && (
                    <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr><th>Line</th><th>Code</th><th>Problem</th></tr>
                        </thead>
                        <tbody>
                          {importState.result.errors.map((er, i) => (
                            <tr key={i}>
                              <td>{er.row}</td>
                              <td className="font-mono">{er.code || '—'}</td>
                              <td style={{ color: '#fca5a5' }}>{er.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importState.result.skipped > importState.result.errors.length && (
                        <div className="text-muted" style={{ fontSize: '0.75rem', padding: '6px 2px' }}>
                          …and {importState.result.skipped - importState.result.errors.length} more.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={importState.busy} onClick={() => setImportState(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={importState.busy || !importState.result || importState.result.created + importState.result.updated === 0}
                onClick={confirmImport}
              >
                {importState.busy && importState.result
                  ? 'Importing…'
                  : importState.result
                    ? `Import ${importState.result.created + importState.result.updated} item(s)`
                    : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
