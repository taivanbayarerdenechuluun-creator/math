import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminForMutation, audit, setSetting } from "@/lib/guard";
import { rateLimit } from "@/lib/rate-limit";
import { announcementSchema, assessmentSchema, questionSchema, roleSchema, settingSchema, userUpdateSchema } from "@/lib/admin-schemas";
import { createQuestion, deleteQuestion, restoreVersion, updateQuestion } from "@/lib/admin-questions";
import { checkImage, saveAsset } from "@/lib/storage";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ path: string[] }> };

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const body = async (req: Request) => req.json().catch(() => null);
const bad = (e: z.ZodError) => err(`${e.issues[0].path.join(".") || "request"}: ${e.issues[0].message}`, 400);
const BUILTIN_ROLES = ["USER", "ADMIN"];
const MAX_IMAGE = 2 * 1024 * 1024;

async function handle(req: Request, { params }: Ctx, method: "POST" | "PUT" | "DELETE") {
  const g = await adminForMutation(req);
  if ("res" in g) return g.res;
  const admin = g.admin;
  if (!rateLimit(`admin:${admin.id}`, 240, 60_000)) return err("Too many requests.", 429);
  const [res, id, sub] = (await params).path;

  // ---------- upload ----------
  if (res === "upload" && method === "POST" && !id) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return err("No file uploaded.");
    if (file.size > MAX_IMAGE) return err("File too large (max 2048 KB).", 413);
    const checked = checkImage(Buffer.from(await file.arrayBuffer()), MAX_IMAGE);
    if (!checked.ok) return err(checked.error, 415);
    const url = await saveAsset(checked.bytes, checked.ext);
    await audit(admin.id, "asset.upload", url);
    return NextResponse.json({ url });
  }

  // ---------- questions ----------
  if (res === "questions") {
    if (method === "POST" && !id) {
      const p = questionSchema.safeParse(await body(req));
      if (!p.success) return bad(p.error);
      const r = await createQuestion(p.data, admin.id);
      return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : err(r.error, r.status);
    }
    if (method === "PUT" && id && !sub) {
      const p = questionSchema.safeParse(await body(req));
      if (!p.success) return bad(p.error);
      const r = await updateQuestion(id, p.data, admin.id);
      return r.ok ? NextResponse.json({ version: r.version }) : err(r.error, r.status);
    }
    if (method === "POST" && id && sub === "restore") {
      const p = z.object({ version: z.number().int().min(1) }).safeParse(await body(req));
      if (!p.success) return bad(p.error);
      const r = await restoreVersion(id, p.data.version, admin.id);
      return r.ok ? NextResponse.json({ version: r.version }) : err(r.error, r.status);
    }
    if (method === "DELETE" && id && !sub) {
      const r = await deleteQuestion(id, admin.id);
      return r.ok ? NextResponse.json({ retired: r.retired }) : err(r.error, r.status);
    }
  }

  // ---------- users ----------
  if (res === "users" && method === "PUT" && id && !sub) {
    const p = userUpdateSchema.safeParse(await body(req));
    if (!p.success) return bad(p.error);
    const target = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!target) return err("User not found.", 404);
    const data: { roleId?: string; disabledAt?: Date | null } = {};
    if (p.data.roleName !== undefined) {
      const role = await db.role.findUnique({ where: { name: p.data.roleName } });
      if (!role) return err("Unknown role.");
      data.roleId = role.id;
    }
    if (p.data.disabled !== undefined) data.disabledAt = p.data.disabled ? new Date() : null;

    const losingAdmin = target.role.name === "ADMIN" && ((p.data.roleName && p.data.roleName !== "ADMIN") || p.data.disabled === true);
    if (target.id === admin.id && (data.roleId || p.data.disabled)) return err("You cannot change your own role or suspend yourself.", 409);
    if (losingAdmin && (await db.user.count({ where: { role: { name: "ADMIN" }, disabledAt: null } })) <= 1) return err("There must always be at least one active administrator.", 409);

    await db.user.update({ where: { id }, data });
    await audit(admin.id, "user.update", id, { role: p.data.roleName, disabled: p.data.disabled });
    return NextResponse.json({ ok: true });
  }

  // ---------- assessments ----------
  if (res === "assessments" && (method === "POST" || method === "PUT")) {
    const p = assessmentSchema.safeParse(await body(req));
    if (!p.success) return bad(p.error);
    const a = p.data;
    const cats = a.categorySlugs.length ? await db.category.findMany({ where: { slug: { in: a.categorySlugs } } }) : await db.category.findMany();
    if (a.categorySlugs.length && cats.length !== a.categorySlugs.length) return err("Unknown category.");
    const slugSet = new Set(cats.map((c) => c.slug));
    if (Object.keys(a.categoryWeights).some((k) => !slugSet.has(k))) return err("categoryWeights contains a category that is not part of this assessment.");

    // Questions that can actually be served: active, in the chosen categories, inside the difficulty range, and
    // (when the admin curated a pool) one of the picked questions.
    const poolIds = [...new Set(a.questionIds)];
    const where = { active: true, categoryId: { in: cats.map((c) => c.id) }, difficulty: { gte: a.difficultyMin, lte: a.difficultyMax }, ...(poolIds.length ? { id: { in: poolIds } } : {}) };
    const available = await db.question.count({ where });
    if (poolIds.length && available !== poolIds.length) return err("Some picked questions are inactive, outside the selected categories, or outside the difficulty range.");
    if (a.questionCount > available) return err(`Only ${available} servable questions exist for these settings (active, selected categories, difficulty ${a.difficultyMin}-${a.difficultyMax}${poolIds.length ? ", picked pool" : ""}).`);
    // Every weighted category must be able to supply at least one question, otherwise the weight is meaningless.
    for (const slug of Object.keys(a.categoryWeights)) {
      const n = await db.question.count({ where: { ...where, category: { slug } } });
      if (n === 0) return err(`Category ${slug} has no servable questions for these settings.`);
    }
    const data = { titleEn: a.titleEn, titleMn: a.titleMn, descEn: a.descEn, descMn: a.descMn, questionCount: a.questionCount, durationSec: a.durationSec, adaptive: a.adaptive, difficultyMin: a.difficultyMin, difficultyMax: a.difficultyMax, categoryWeights: JSON.stringify(a.categoryWeights), categorySlugs: a.categorySlugs.join(","), active: a.active };

    if (method === "POST" && !id) {
      if (await db.assessment.findUnique({ where: { slug: a.slug } })) return err("That slug is already in use.", 409);
      const row = await db.assessment.create({ data: { slug: a.slug, ...data, questions: { create: poolIds.map((questionId, position) => ({ questionId, position })) } } });
      await audit(admin.id, "assessment.create", row.id, { slug: a.slug });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    if (method === "PUT" && id) {
      const cur = await db.assessment.findUnique({ where: { id } });
      if (!cur) return err("Assessment not found.", 404);
      if (cur.slug !== a.slug) return err("The slug cannot be changed.", 409);
      // Changing what is measured makes old and new results non-comparable: bump the version.
      const curPool = (await db.assessmentQuestion.findMany({ where: { assessmentId: id }, select: { questionId: true } })).map((x) => x.questionId).sort();
      const material =
        cur.questionCount !== data.questionCount || cur.categorySlugs !== data.categorySlugs || cur.adaptive !== data.adaptive ||
        cur.difficultyMin !== data.difficultyMin || cur.difficultyMax !== data.difficultyMax || cur.categoryWeights !== data.categoryWeights ||
        JSON.stringify(curPool) !== JSON.stringify([...poolIds].sort());
      await db.$transaction([
        db.assessment.update({ where: { id }, data: { ...data, version: material ? cur.version + 1 : cur.version } }),
        db.assessmentQuestion.deleteMany({ where: { assessmentId: id } }),
        db.assessmentQuestion.createMany({ data: poolIds.map((questionId, position) => ({ assessmentId: id, questionId, position })) }),
      ]);
      await audit(admin.id, "assessment.update", id, { versionBumped: material });
      return NextResponse.json({ version: material ? cur.version + 1 : cur.version });
    }
  }

  // ---------- settings ----------
  if (res === "settings" && method === "PUT" && !id) {
    const p = settingSchema.safeParse(await body(req));
    if (!p.success) return bad(p.error);
    await setSetting(p.data.key, p.data.value);
    await audit(admin.id, "setting.update", p.data.key, { value: p.data.value });
    return NextResponse.json({ ok: true });
  }

  // ---------- announcements ----------
  if (res === "announcements") {
    if (method === "POST" && !id) {
      const p = announcementSchema.safeParse(await body(req));
      if (!p.success) return bad(p.error);
      const row = await db.announcement.create({ data: p.data });
      await audit(admin.id, "announcement.create", row.id);
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    if (method === "PUT" && id) {
      const p = z.object({ active: z.boolean() }).safeParse(await body(req));
      if (!p.success) return bad(p.error);
      await db.announcement.update({ where: { id }, data: { active: p.data.active } }).catch(() => null);
      await audit(admin.id, "announcement.update", id, { active: p.data.active });
      return NextResponse.json({ ok: true });
    }
    if (method === "DELETE" && id) {
      await db.announcement.delete({ where: { id } }).catch(() => null);
      await audit(admin.id, "announcement.delete", id);
      return NextResponse.json({ ok: true });
    }
  }

  // ---------- roles ----------
  if (res === "roles") {
    if (method === "POST" && !id) {
      const p = roleSchema.safeParse(await body(req));
      if (!p.success) return bad(p.error);
      if (await db.role.findUnique({ where: { name: p.data.name } })) return err("Role already exists.", 409);
      const row = await db.role.create({ data: { name: p.data.name } });
      await audit(admin.id, "role.create", row.id, { name: p.data.name });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    if (method === "DELETE" && id) {
      const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
      if (!role) return err("Role not found.", 404);
      if (BUILTIN_ROLES.includes(role.name)) return err("Built-in roles cannot be deleted.", 409);
      if (role._count.users > 0) return err("Reassign the users with this role first.", 409);
      await db.role.delete({ where: { id } });
      await audit(admin.id, "role.delete", id, { name: role.name });
      return NextResponse.json({ ok: true });
    }
  }

  return err("Not found.", 404);
}

export const POST = (req: Request, ctx: Ctx) => handle(req, ctx, "POST");
export const PUT = (req: Request, ctx: Ctx) => handle(req, ctx, "PUT");
export const DELETE = (req: Request, ctx: Ctx) => handle(req, ctx, "DELETE");
