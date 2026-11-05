import { db } from "@/lib/db";
import { QuestionEditor } from "@/components/admin/QuestionEditor";

export default async function Page() {
  const categories = await db.category.findMany({ orderBy: { slug: "asc" }, select: { slug: true, nameEn: true } });
  return <QuestionEditor categories={categories} initial={null} />;
}
