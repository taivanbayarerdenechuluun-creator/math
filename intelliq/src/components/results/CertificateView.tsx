"use client";
import Link from "next/link";
import { Printer } from "lucide-react";
import { LogoMark } from "../Logo";
import { useApp } from "../Providers";

export function CertificateView({ name, titleEn, titleMn, date, code, resultId }: { name: string; titleEn: string; titleMn: string; date: string; code: string; resultId: string }) {
  const { tt, lang } = useApp();
  const title = lang === "en" ? titleEn : titleMn;
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/results/${resultId}`} className="text-sm text-muted hover:text-ink">← {tt("Back to results", "Үр дүн рүү буцах")}</Link>
        <button onClick={() => window.print()} className="btn btn-primary !min-h-10 text-sm"><Printer size={16} /> {tt("Print / save as PDF", "Хэвлэх / PDF хадгалах")}</button>
      </div>
      <section className="rounded-2xl border-4 border-double border-violet bg-card p-8 text-center shadow-[var(--shadow)] sm:p-14 print:shadow-none" aria-label={tt("Participation certificate", "Оролцооны гэрчилгээ")}>
        <div className="mx-auto w-fit"><LogoMark size={56} /></div>
        <p className="mt-3 font-display text-xl font-bold tracking-tight">INTELL<span className="grad-text">IQ</span></p>
        <h1 className="mt-8 font-display text-3xl font-bold sm:text-4xl">{tt("Certificate of Participation", "Оролцооны гэрчилгээ")}</h1>
        <p className="mt-8 text-sm text-muted">{tt("This certifies that", "Энэхүү гэрчилгээгээр")}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{name}</p>
        <p className="mx-auto mt-6 max-w-lg text-muted">
          {tt(`completed the “${title}” practice cognitive assessment on ${date}.`, `${date}-нд “${title}” дадлага танин мэдэхүйн тестийг дууссаныг баталгаажуулж байна.`)}
        </p>
        <p className="mt-8 font-mono text-xs text-muted">{tt("Report ID", "Тайлангийн дугаар")}: {code}</p>
        <p className="mx-auto mt-8 max-w-lg border-t border-line pt-5 text-xs text-muted">
          {tt("This certificate recognises participation and completion only. It is not an IQ certification, a score, or a professional or clinical qualification.", "Энэ гэрчилгээ зөвхөн оролцоо, дуусгалтыг тэмдэглэнэ. Энэ нь IQ-ийн гэрчилгээ, оноо, мэргэжлийн болон клиникийн мэргэшил биш.")}
        </p>
      </section>
    </main>
  );
}
