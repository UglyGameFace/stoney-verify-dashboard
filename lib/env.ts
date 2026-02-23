export function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getCsv(name: string): string[] {
  const v = process.env[name] || "";
  return v.split(",").map(s => s.trim()).filter(Boolean);
}
