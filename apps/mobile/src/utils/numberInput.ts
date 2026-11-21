export function parseLocaleNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    return NaN;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function validateHeightCm(rawValue: string): { value?: number; error?: string } {
  const h = parseLocaleNumber(rawValue);
  if (Number.isNaN(h) || h <= 0) {
    return { error: 'Lütfen geçerli bir boy değeri girin' };
  }
  if (h < 50) {
    return { error: 'Lütfen boyunuzu cm cinsinden girin (örn: 170)' };
  }
  if (h < 100 || h > 250) {
    return { error: 'Boy değeri 100 ile 250 cm arasında olmalıdır' };
  }
  return { value: h };
}

export function validateWeightKg(rawValue: string): { value?: number; error?: string } {
  const w = parseLocaleNumber(rawValue);
  if (Number.isNaN(w) || w <= 0) {
    return { error: 'Lütfen geçerli bir kilo değeri girin' };
  }
  if (w < 25 || w > 300) {
    return { error: 'Kilo değeri 25 ile 300 kg arasında olmalıdır' };
  }
  return { value: w };
}

export function validateAgeYears(rawValue: string): { value?: number; error?: string } {
  const a = parseLocaleNumber(rawValue);
  if (Number.isNaN(a) || !Number.isInteger(a) || a <= 0) {
    return { error: 'Lütfen geçerli bir yaş değeri girin' };
  }
  if (a < 12 || a > 120) {
    return { error: 'Yaş değeri 12 ile 120 arasında olmalıdır' };
  }
  return { value: a };
}
