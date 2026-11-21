import { createServerFn } from "@tanstack/react-start";

const SPECIALTY_MAX = 100;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function field(fd: FormData, key: string, max: number): string {
  const v = fd.get(key);
  if (typeof v !== "string") throw new Error(`Missing ${key}`);
  const t = v.trim();
  if (!t || t.length > max) throw new Error(`Invalid ${key}`);
  return t;
}

export const submitPractice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Invalid submission");
    const photo = d.get("photo");
    if (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
      throw new Error("Profile photo must be an image under 5MB");
    }
    return {
      full_name: field(d, "full_name", 120),
      title: field(d, "title", 120),
      specialty: field(d, "specialty", SPECIALTY_MAX),
      location: field(d, "location", 120),
      description: field(d, "description", 2000),
      photo,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("attorney-photos")
      .upload(path, data.photo, { contentType: data.photo.type, upsert: false });
    if (upErr) throw new Error("Photo upload failed");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("attorney-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signErr || !signed) throw new Error("Photo processing failed");
    const { error: insErr } = await supabaseAdmin.from("attorney_submissions").insert({
      full_name: data.full_name,
      title: data.title,
      specialty: data.specialty,
      location: data.location,
      description: data.description,
      photo_url: signed.signedUrl,
      status: "pending",
    });
    if (insErr) throw new Error("Submission failed");
    return { ok: true };
  });
