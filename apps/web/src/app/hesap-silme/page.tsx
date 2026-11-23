'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Trash2,
  Smartphone,
  Globe,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useAppContext } from '@/components/AppContext';

export default function AccountDeletionPage() {
  const { locale } = useAppContext();
  const isEn = locale === 'en';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError(
        isEn
          ? 'Please confirm that you understand account deletion is permanent.'
          : 'Lütfen hesap silme işleminin kalıcı olduğunu onaylayın.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await publicApi.submitContact({
        name: name.trim() || email.trim(),
        email: email.trim(),
        category: 'Hesap ve Veri Silme Talebi',
        subject: 'Hesabımı ve verilerimi silmek istiyorum',
        message: [
          'Talep Türü: Web Üzerinden Kalıcı Hesap ve Veri Silme',
          `Kayıtlı E-posta: ${email.trim()}`,
          reason.trim() ? `Not / Neden: ${reason.trim()}` : 'Not: Belirtilmedi',
        ].join('\n'),
      });
      setSubmittedId(res.id);
      setName('');
      setEmail('');
      setReason('');
      setConfirmed(false);
    } catch (err: any) {
      setError(
        err?.message ||
          (isEn
            ? 'Failed to submit deletion request. Please email kvkk@kadinatlasi.com.'
            : 'Talep gönderilemedi. Lütfen kvkk@kadinatlasi.com adresine e-posta gönderin.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {isEn ? 'Account & Data Deletion' : 'Hesap ve Veri Silme Merkezi'}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">
          {isEn
            ? 'Delete Your Kadın Atlası Account & Data'
            : 'Hesabımı ve Verilerimi Silmek İstiyorum'}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
          {isEn
            ? 'In accordance with Google Play policies and KVKK/GDPR, you can permanently delete your Kadın Atlası account and associated health data directly inside the mobile app or by submitting a verified request below.'
            : 'Google Play veri güvenliği politikaları ve 6698 sayılı KVKK uyarınca Kadın Atlası hesabınızı ve tüm sağlık verilerinizi uygulama içinden anında silebilir veya aşağıdaki web formu üzerinden kalıcı silme talebi oluşturabilirsiniz.'}
        </p>
      </div>

      {/* Two Clear Methods */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF69B4]/15 text-[#E91E63]">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-main)]">
                {isEn ? 'Option 1: Instant In-App Deletion' : '1. Yol: Uygulama İçinden Anında Silme'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isEn ? 'Recommended · Processed immediately' : 'Önerilen · Anında kalıcı olarak silinir'}
              </p>
            </div>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--text-muted)]">
            <li>
              {isEn ? 'Open the Kadın Atlası mobile app.' : 'Kadın Atlası mobil uygulamasını açın.'}
            </li>
            <li>
              {isEn ? (
                <>
                  Go to <strong>Profile / Settings &gt; My Data &gt; Delete Account</strong>.
                </>
              ) : (
                <>
                  <strong>Ayarlar &gt; Verilerim &gt; Hesabı Sil</strong> yolunu izleyin.
                </>
              )}
            </li>
            <li>
              {isEn
                ? 'Confirm deletion to immediately erase your account and health logs.'
                : 'Onay verdiğiniz anda hesabınız ve tüm sağlık kayıtlarınız kalıcı olarak silinir.'}
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/15 text-[#7C3AED]">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-main)]">
                {isEn ? 'Option 2: Web Deletion Request' : '2. Yol: Web Üzerinden Silme Talebi'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isEn
                  ? 'Without installing the app · Up to 30 days'
                  : 'Uygulamaya erişemiyorsanız · En geç 30 gün içinde'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {isEn
              ? 'If you have already uninstalled the app or cannot sign in, fill out the form below with your registered email address or send an email directly to kvkk@kadinatlasi.com.'
              : 'Uygulamayı sildiyseniz veya hesabınıza erişemiyorsanız, kayıtlı e-posta adresinizle aşağıdaki formu doldurarak ya da doğrudan kvkk@kadinatlasi.com adresine yazarak hesabınızın silinmesini talep edebilirsiniz.'}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#E91E63]">
            <Mail className="h-4 w-4" />
            <a href="mailto:kvkk@kadinatlasi.com?subject=Hesab%C4%B1m%C4%B1%20ve%20Verilerimi%20Silmek%20%C4%B0stiyorum">
              kvkk@kadinatlasi.com
            </a>
          </div>
        </div>
      </div>

      {/* Data Scope Disclosure */}
      <div className="mt-8 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-[#E91E63]" />
          <h2 className="text-base font-extrabold text-[var(--text-main)]">
            {isEn
              ? 'What Data Is Deleted & Retention Disclosures'
              : 'Hangi Veriler Silinir ve Saklama Süreleri'}
          </h2>
        </div>
        <div className="mt-4 grid gap-6 text-sm text-[var(--text-muted)] md:grid-cols-2">
          <div>
            <h3 className="font-bold text-[var(--text-main)]">
              {isEn ? 'Permanently Deleted Data:' : 'Kalıcı Olarak Silinen Veriler:'}
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                {isEn
                  ? 'Account credentials, profile info, and notification tokens'
                  : 'Hesap bilgileri (e-posta, kullanıcı adı, profil fotoğrafı) ve bildirim tokenları'}
              </li>
              <li>
                {isEn
                  ? 'Cycle, period, ovulation, pregnancy, postpartum, symptom, water, sleep & step logs'
                  : 'Regl döngüsü, ovülasyon, gebelik, lohusalık, semptom, su, uyku ve adım kayıtları'}
              </li>
              <li>
                {isEn
                  ? 'NOVA AI chat history and personalized AI memory'
                  : 'NOVA AI sohbet geçmişi ve kişisel hafıza kayıtları'}
              </li>
              <li>
                {isEn
                  ? 'Community questions, answers, and profile links'
                  : 'Topluluk soruları, cevapları, yorumları ve takip ilişkileri'}
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-main)]">
              {isEn ? 'Retained Data (Legal Obligations):' : 'Yasal Zorunlulukla Saklanan Veriler:'}
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                {isEn
                  ? 'Billing receipts & tax records remain with Google Play Store / Apple App Store as required by applicable tax law (app-side subscription records are deleted with your account).'
                  : 'Ödeme ve fatura kayıtları ilgili mağazalar (Google Play Store / Apple App Store) nezdinde vergi mevzuatı gereği saklanır; uygulama veritabanındaki abonelik kayıtları hesabınızla birlikte silinir.'}
              </li>
              <li>
                {isEn
                  ? 'Rolling daily database backups expire within 7 days (purged within at most 30 days)'
                  : 'Günlük veritabanı yedekleri 7 günlük döngüyle yenilenir ve en geç 30 gün içinde tamamen temizlenir.'}
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
              <Clock className="h-3.5 w-3.5 text-[#7C3AED]" />
              {isEn
                ? 'Processing time: Immediate in-app; within 30 days via web request.'
                : 'İşlem süresi: Uygulama içinde anında; web taleplerinde en geç 30 gün içinde.'}
            </p>
          </div>
        </div>
      </div>

      {/* Web Deletion Request Form */}
      <div className="mt-8 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-extrabold text-[var(--text-main)]">
          {isEn
            ? 'Submit Account & Data Deletion Request'
            : 'Hesabımı ve Verilerimi Silmek İstiyorum (Web Talep Formu)'}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isEn
            ? 'Enter the email address registered to your Kadın Atlası account. Our data protection team will verify ownership and permanently delete your account.'
            : 'Kadın Atlası hesabınıza kayıtlı e-posta adresini girin. Veri koruma ekibimiz hesap sahipliğini doğrulayıp hesabınızı ve verilerinizi kalıcı olarak silecektir.'}
        </p>

        {submittedId ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <h3 className="mt-3 text-lg font-extrabold text-emerald-900 dark:text-emerald-200">
              {isEn
                ? 'Account Deletion Request Received'
                : 'Hesap ve Veri Silme Talebiniz Alındı'}
            </h3>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {isEn
                ? `Reference ID: ${submittedId}. Your request will be processed within 30 days.`
                : `Talep referans numaranız: ${submittedId}. İşleminiz yasal süre içinde (en geç 30 gün) tamamlanacaktır.`}
            </p>
            <button
              type="button"
              onClick={() => setSubmittedId(null)}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
            >
              {isEn ? 'Submit Another Request' : 'Yeni Talep Gönder'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="del-email"
                  className="block text-xs font-bold text-[var(--text-muted)]"
                >
                  {isEn ? 'Registered Email Address *' : 'Hesaba Kayıtlı E-posta Adresi *'}
                </label>
                <input
                  id="del-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@eposta.com"
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                />
              </div>
              <div>
                <label
                  htmlFor="del-name"
                  className="block text-xs font-bold text-[var(--text-muted)]"
                >
                  {isEn ? 'Full Name (Optional)' : 'Ad Soyad (İsteğe Bağlı)'}
                </label>
                <input
                  id="del-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="del-reason"
                className="block text-xs font-bold text-[var(--text-muted)]"
              >
                {isEn
                  ? 'Additional Details / Reason (Optional)'
                  : 'Ek Açıklama veya Silme Nedeni (İsteğe Bağlı)'}
              </label>
              <textarea
                id="del-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isEn
                    ? 'Optionally tell us why you are deleting your account...'
                    : 'İsteğe bağlı olarak silme nedeninizi belirtebilirsiniz...'
                }
                className="mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2.5 text-sm text-[var(--text-main)]"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-soft)] accent-[#E91E63]"
              />
              <span>
                {isEn
                  ? 'I want to permanently delete my Kadın Atlası account and all associated health data. I understand this action cannot be undone.'
                  : 'Kadın Atlası hesabımın ve bağlı tüm sağlık verilerimin kalıcı olarak silinmesini istiyorum; bu işlemin geri alınamayacağını anlıyorum.'}
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <Link
                href="/sayfa/gizlilik-politikasi"
                className="text-xs font-semibold text-[#E91E63] hover:underline"
              >
                {isEn ? 'View Privacy Policy & KVKK Notice →' : 'Gizlilik Politikası ve KVKK Metni →'}
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {submitting
                  ? isEn
                    ? 'Submitting...'
                    : 'Gönderiliyor...'
                  : isEn
                    ? 'Delete My Account & Data'
                    : 'Hesabımı ve Verilerimi Sil'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
