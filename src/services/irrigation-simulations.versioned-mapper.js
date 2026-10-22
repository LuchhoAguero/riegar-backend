const { resolveStoredVersion, resolveActiveDescriptor, ACTIVE_DESCRIPTOR } = require("./irrigation-simulations.versions");
const { invalid, isPlainObject, ownData, copyJson, V2_COLUMNS, snapshotBoundary } = require("./irrigation-simulations.snapshot");

function checkV1Extensions(row, descriptor) {
  if (descriptor.contractVersion !== "irrigation-contract-v1") return;
  // Old-schema rows and narrow HISTORY projections may omit these columns.
  for (const key of V2_COLUMNS) if (Object.hasOwn(row, key) && ownData(row, key) !== null) invalid();
}
function mapStoredDetailVersioned(row) {
  return snapshotBoundary(() => {
    const descriptor = resolveStoredVersion(row);
    checkV1Extensions(row, descriptor);
    return descriptor.readDetail(row);
  });
}
function mapHistorySummaryVersioned(row) {
  return snapshotBoundary(() => {
    const descriptor = resolveStoredVersion(row);
    checkV1Extensions(row, descriptor);
    return descriptor.readHistory(row);
  });
}
function mapCalculationToSnapshotVersioned(args, { descriptor = ACTIVE_DESCRIPTOR } = {}) {
  const active = resolveActiveDescriptor(descriptor);
  return snapshotBoundary(() => {
    const result = copyJson(ownData(args, "calculationResult"));
    if (!isPlainObject(result) || ownData(result, "ok") !== true || !isPlainObject(result.metadata) ||
      !Array.isArray(result.output?.diagnostics?.items)) invalid();
    // Validate the result's provenance, but never use it to select the writer.
    const resultDescriptor = resolveStoredVersion({ contract_version: result.contractVersion, model_version: result.modelVersion,
      source_hash: result.sourceHash, model_metadata: result.metadata, diagnostics: result.output.diagnostics.items });
    if (resultDescriptor !== active) invalid("MODEL_MISMATCH");
    return active.mapWrite({ ...args, calculationResult: result });
  }, { preserveApplicationInput: true });
}
function publicSnapshotVersioned(snapshot) {
  return snapshotBoundary(() => {
    if (!isPlainObject(snapshot)) invalid();
    const model = ownData(snapshot, "model");
    const descriptor = resolveStoredVersion({ contract_version: ownData(model, "contractVersion"), model_version: ownData(model, "modelVersion"),
      source_hash: ownData(model, "sourceHash"), model_metadata: ownData(snapshot, "metadata"),
      diagnostics: ownData(ownData(ownData(snapshot, "output"), "diagnostics"), "items") });
    const metadata = Object.fromEntries(descriptor.publicMetadataKeys.map(key => [key, copyJson(ownData(snapshot.metadata, key))]));
    return { simulation: copyJson(ownData(snapshot, "simulation")), model: copyJson(model),
      input: copyJson(ownData(snapshot, "input")), output: copyJson(ownData(snapshot, "output")), metadata };
  });
}
module.exports = { mapStoredDetailVersioned, mapHistorySummaryVersioned, mapCalculationToSnapshotVersioned, publicSnapshotVersioned };
