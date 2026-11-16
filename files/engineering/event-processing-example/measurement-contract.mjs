const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const date = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  );
};

export function validateMeasurement(record) {
  if (!record || typeof record !== "object" || Array.isArray(record))
    return ["record must be an object"];
  if (record.status === "measurement-not-performed")
    return record.value == null ? [] : ["unperformed measurement cannot contain a value"];
  if (record.status !== "measured") return ["invalid status"];
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.projectSlug || ""))
    errors.push("projectSlug required");
  if (!/^[a-f0-9]{7,40}$/i.test(record.sourceCommit || "")) errors.push("sourceCommit required");
  if (!date(record.observedAt)) errors.push("valid observedAt required");
  if (!nonempty(record.metric) || !nonempty(record.unit) || !Number.isFinite(record.value))
    errors.push("finite metric value and unit required");
  if (!Number.isInteger(record.sampleSize) || record.sampleSize < 1)
    errors.push("positive sampleSize required");
  for (const field of ["runtime", "hardware", "fixture", "method", "limitations"])
    if (!nonempty(record[field])) errors.push(`${field} required`);
  if (!/^[a-f0-9]{64}$/i.test(record.rawOutputSha256 || ""))
    errors.push("rawOutputSha256 required");
  return errors;
}
