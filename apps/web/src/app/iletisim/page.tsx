'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, MessageSquareHeart, Mail, ShieldCheck } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useAppContext } from '@/components/AppContext';

export default function ContactPage() {
  const { locale, t } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Web İletişim');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await publicApi.submitContact({
        name,
        email,
        category,
        subject,
        message,
      });
      setSubmittedId(res.id);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(
        err?.message || (locale === 'tr' ? 'Mesaj gönderilemedi.' : 'Failed to send message.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3.5 py-1 text-xs font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
          <MessageSquareHeart className="h-3.5 w-3.5" aria-hidden="true" />
          {t.contact.badge}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">
          {t.contact.title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
          {t.contact.subtitle}
        </p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-5">
        <div className="flex flex-col justify-between rounded-3xl border border-[var(--border-soft)] bg-[#FFF0F5] p-6 dark:bg-[#231731] md:col-span-2">
          <div>
            <img
              src="/images/mascots/7.png"
              alt="Kadın Atlası Destek"
              className="mx-auto h-32 w-32 object-contain"
            />
            <h2 className="mt-4 text-lg font-extrabold text-[var(--text-main)]">
              {locale === 'tr' ? 'Doğrudan Destek Hattı' : 'Direct Support Inbox'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              {locale === 'tr'
                ? 'Gönderdiğiniz tüm mesajlar doğrudan Kadın Atlası destek ekibimizin yönetim paneline iletilir.'
                : 'Every message submitted here goes straight into our support team workspace.'}
            </p>
          </div>
          <div className="mt-6 space-y-3 rounded-2xl bg-[var(--bg-card)] p-4 text-xs text-[var(--text-muted)]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {locale === 'tr' ? 'Genel Destek & İletişim' : 'General Support & Inquiries'}
              </div>
              <a
                href="mailto:destek@kadinatlasi.com"
                className="mt-1 inline-flex items-center gap-1.5 font-bold text-[#E91E63] underline decoration-pink-300 underline-offset-2 hover:text-[#7C3AED] dark:text-[#FF69B4]"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>destek@kadinatlasi.com</span>
              </a>
            </div>

            <div className="border-t border-[var(--border-soft)] pt-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {locale === 'tr' ? 'KVKK & Veri Koruma Başvuruları' : 'Privacy & KVKK Data Requests'}
              </div>
              <a
                href="mailto:kvkk@kadinatlasi.com"
                className="mt-1 inline-flex items-center gap-1.5 font-bold text-[#7C3AED] underline decoration-purple-300 underline-offset-2 hover:text-[#E91E63] dark:text-[#c4b5fd]"
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>kvkk@kadinatlasi.com</span>
              </a>
            </div>

            <div className="border-t border-[var(--border-soft)] pt-2 text-[11px]">
              {locale === 'tr'
                ? 'Ortalama yanıt süresi: 24 saat içinde (KVKK başvuruları yasal olarak en geç 30 gün içinde sonuçlandırılır).'
                : 'Typical response time: under 24 hours (formal KVKK/GDPR requests are completed within 30 days).'}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 sm:p-8 md:col-span-3">
          {submittedId ? (
            <div className="py-10 text-center" role="status" aria-live="polite">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-extrabold text-[var(--text-main)]">
                {t.contact.successTitle}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t.contact.successDesc}</p>
              <button
                type="button"
                onClick={() => setSubmittedId(null)}
                className="mt-6 rounded-xl border border-[var(--border-soft)] px-5 py-2.5 text-xs font-bold text-[var(--text-main)] hover:border-[#FF69B4]"
              >
                {locale === 'tr' ? 'Yeni Mesaj Gönder' : 'Send Another Message'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-bold text-[var(--text-muted)]"
                  >
                    {t.contact.name}
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-bold text-[var(--text-muted)]"
                  >
                    {t.contact.email}
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="contact-category"
                    className="block text-xs font-bold text-[var(--text-muted)]"
                  >
                    {t.contact.category}
                  </label>
                  <select
                    id="contact-category"
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-3 py-2.5 text-sm text-[var(--text-main)]"
                  >
                    <option value="Web İletişim">
                      {locale === 'tr' ? 'Genel Soru' : 'General Question'}
                    </option>
                    <option value="Uygulama Desteği">
                      {locale === 'tr' ? 'Uygulama Desteği' : 'App Support'}
                    </option>
                    <option value="Abonelik">
                      {locale === 'tr' ? 'Premium / Abonelik' : 'Premium / Billing'}
                    </option>
                    <option value="KVKK / Veri Talebi">
                      {locale === 'tr' ? 'KVKK / Veri Talebi' : 'KVKK / Data Protection Request'}
                    </option>
                    <option value="Hesap ve Veri Silme Talebi">
                      {locale === 'tr'
                        ? 'Hesabımı ve verilerimi silmek istiyorum'
                        : 'I want to delete my account and data'}
                    </option>
                    <option value="İş Birliği">
                      {locale === 'tr' ? 'İş Birliği / Basın' : 'Partnership / Press'}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-bold text-[var(--text-muted)]"
                  >
                    {t.contact.subject}
                  </label>
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    required
                    minLength={3}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-xs font-bold text-[var(--text-muted)]"
                >
                  {t.contact.message}
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  minLength={10}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF69B4] to-[#D946EF] py-3.5 text-sm font-bold text-white shadow-md shadow-pink-500/20 transition hover:opacity-95"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>{submitting ? t.contact.sending : t.contact.send}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
