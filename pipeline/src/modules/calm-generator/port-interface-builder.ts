import { TypedUnit } from '../../types/typed-facts';
import { CalmNode, CalmInterface } from '../../types/calm';

/**
 * T-PC1-6/T-SC-6 (B-formal-interface-port) — server.port -> a real
 * `port-interface` CalmInterface (types/calm.ts's own already-verified-against-
 * calm.finos.org enum — NOT the informal "tcp-host-port" name the original
 * gap-closure research doc used; that name isn't a real member of this
 * project's own verified CalmInterfaceType union, so using it would have
 * been a real schema-invalid value, caught here before shipping rather than
 * at `calm validate` time). APPENDED to the node's existing interfaces,
 * never overwriting attachInterfaces' own http-entry-point-derived ones —
 * deliberately a separate small function, not folded into attachInterfaces'
 * generic mechanism, since that mechanism assumes every category it
 * handles is route-shaped ("GET /path"), which a bare port number is not.
 */
export function attachPortInterfaces(units: TypedUnit[], nodes: CalmNode[]): void {
  const nodesById = new Map(nodes.map((n) => [n['unique-id'], n]));
  for (const unit of units) {
    const node = nodesById.get(unit.id);
    if (!node) continue;

    const portFacts = unit.evidence
      .filter((e) => e.category === 'spring-config' && e.signal.startsWith('server.port='))
      .map((e) => ({ port: Number(e.signal.slice('server.port='.length)), ref: e.ref }))
      .filter((p) => Number.isFinite(p.port));
    if (portFacts.length === 0) continue;

    // Review finding (2026-08-09) — a real, confirmed non-determinism bug:
    // server.port can legitimately be set in more than one config file for
    // the same root (e.g. base 8080, prod-profile 9443) — Weaver has no
    // runtime profile-activation context, so it can never know which one
    // actually applies. Picking "whichever evidence entry came first" was
    // silently deciding this via fs.readdirSync's filesystem-dependent
    // directory-walk order, not a real rule — confirmed to differ by run.
    // Fixed: emit one real port-interface PER DISTINCT port (never guess a
    // winner, same "cite both real facts" discipline the datasource
    // extraction already uses for multi-file overrides), deduped by port
    // value and sorted by the evidence's own `ref` string so output order
    // is stable regardless of directory-walk order.
    const distinctPorts = [...new Map(portFacts.map((p) => [p.port, p])).values()].sort((a, b) => a.ref.localeCompare(b.ref));

    const newInterfaces: CalmInterface[] = distinctPorts.map((p, i) => ({
      'unique-id': `${unit.id}::iface-port-${i}`,
      type: 'port-interface',
      port: p.port,
    }));
    node.interfaces = [...(node.interfaces ?? []), ...newInterfaces];
  }
}

/**
 * T-SC-3/T-PC1-3 (B-protocol-populate) — spring.datasource.url's own JDBC
 * scheme -> a real relationship `protocol` value, via the SAME
 * `protocolBySignal` mechanism T-X7-4 already wired for
 * persistence-detection-catalogue.yml's driver-import rows
 * (relationship-builder.ts's `inferredProtocol` looks up EITHER endpoint
 * unit's `evidence.signal` against this map). Reads only `Evidence.signal`
 * (TypedFacts' own public contract) — never reaches into scanner/analysis
 * internals, matching build-calm.ts's own "reads exactly this shape and
 * nothing else about how the facts were produced" discipline.
 *
 * Honest scope note: this only actually populates a relationship's
 * `protocol` field when a real `TypedRelationship` happens to point at or
 * from the spring-config-derived unit carrying this signal. Since these
 * units are synthetic (not backed by a real Graphify graph node id), no
 * structural reconciler edge can ever link to them in a real Weaver run
 * today — in practice this mechanism is proven reachable via a direct unit
 * test (`test/regression.test.js`'s "protocol population" test constructs a
 * synthetic `TypedRelationship` pointing at a spring-config unit and
 * asserts `buildRelationships` returns `protocol: 'JDBC'`), not proven to
 * fire on any real repo's own generated relationships. Same honest
 * "mechanism proven, not guaranteed-to-fire" framing this project already
 * uses for `org.postgresql`'s own protocol row. (Review correction,
 * 2026-08-09: this comment previously claimed the mechanism was already
 * regression-tested — it was not; the test named above was added to make
 * that claim true rather than just softening the wording.)
 */
export function springConfigProtocolBySignal(units: TypedUnit[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of units) {
    for (const e of unit.evidence) {
      if (e.category !== 'spring-config' || !e.signal.startsWith('spring.datasource.url=jdbc:')) continue;
      // Matches persistence-detection-catalogue.yml's own convention (e.g.
      // org.postgresql -> protocol: JDBC): the real CALM protocol value is
      // the literal string "JDBC" for any JDBC connection string,
      // regardless of which database's own subprotocol scheme follows it.
      map.set(e.signal, 'JDBC');
    }
  }
  return map;
}
