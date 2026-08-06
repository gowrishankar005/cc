/**
 * Structural normalization for stable CALM compare.
 * Strips volatile metadata; sorts nodes/relationships/interfaces.
 */
export function normalizeCalm(doc) {
  const clone = JSON.parse(JSON.stringify(doc || {}));

  const nodes = Array.isArray(clone.nodes) ? clone.nodes : [];
  for (const n of nodes) {
    if (n.metadata) {
      n.metadata = n.metadata.filter(
        (m) =>
          m &&
          m.key !== 'x-aac-generated-at' &&
          m.key !== 'x-aac-run-version' // catalogue version can bump without architecture change
      );
      // Drop empty
      if (n.metadata.length === 0) delete n.metadata;
    }
    if (Array.isArray(n.interfaces)) {
      n.interfaces.sort((a, b) => String(a.path || a['unique-id'] || '').localeCompare(String(b.path || b['unique-id'] || '')));
    }
    if (n.controls && typeof n.controls === 'object') {
      // Keep control ids; drop volatile nested timestamps if any later
      const sorted = {};
      for (const k of Object.keys(n.controls).sort()) sorted[k] = n.controls[k];
      n.controls = sorted;
    }
  }
  nodes.sort((a, b) => String(a['unique-id'] || '').localeCompare(String(b['unique-id'] || '')));
  clone.nodes = nodes;

  const rels = Array.isArray(clone.relationships) ? clone.relationships : [];
  rels.sort((a, b) => {
    const ka = `${a['unique-id']}|${a.description}|${JSON.stringify(a['relationship-type'])}`;
    const kb = `${b['unique-id']}|${b.description}|${JSON.stringify(b['relationship-type'])}`;
    return ka.localeCompare(kb);
  });
  // Re-id relationship unique-ids for compare stability (rel-0 order can shuffle)
  rels.forEach((r, i) => {
    if (r['unique-id'] && String(r['unique-id']).startsWith('rel-')) {
      r['unique-id'] = `rel-${i}`;
    }
  });
  clone.relationships = rels;

  if (Array.isArray(clone.metadata)) {
    clone.metadata = clone.metadata.filter(
      (m) => m && m.key !== 'x-aac-generated-at' && m.key !== 'x-aac-package-roots'
    );
    clone.metadata.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }

  return clone;
}

export function structuralFingerprint(doc) {
  const n = normalizeCalm(doc);
  // Drop relationship unique-ids entirely for fingerprint (order already normalized)
  for (const r of n.relationships || []) {
    delete r['unique-id'];
  }
  // Interface unique-ids are path-derived and stable enough; keep path
  for (const node of n.nodes || []) {
    if (node.interfaces) {
      for (const iface of node.interfaces) {
        delete iface['unique-id'];
      }
    }
    // Provenance line numbers can shift with formatting — compare signal set loosely via confidence only
    if (node.metadata) {
      node.metadata = node.metadata.filter((m) => m.key !== 'x-aac-provenance');
    }
  }
  return n;
}
