import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  specialties: string[];
  trigger: React.ReactNode;
  onSubmitted?: () => void;
};

type FieldErrors = Partial<Record<
  "full_name" | "title" | "specialty" | "location" | "description" | "photo",
  string
>>;

export function ListPracticeDialog({ specialties, trigger, onSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    title: "",
    specialty: "",
    location: "",
    description: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const reset = () => {
    setForm({ full_name: "", title: "", specialty: "", location: "", description: "" });
    setPhoto(null);
    setErrors({});
  };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!form.full_name.trim()) e.full_name = "Please enter your full name.";
    if (!form.title.trim()) e.title = "Please enter your professional title.";
    if (!form.specialty) e.specialty = "Please choose a specialty.";
    if (!form.location.trim()) e.location = "Please enter your location.";
    if (!form.description.trim()) e.description = "Please add a short description.";
    if (!photo) {
      e.photo = "Please upload a profile photo.";
    } else if (!photo.type.startsWith("image/")) {
      e.photo = "Profile photo must be an image file.";
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const ext = photo!.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("attorney-photos")
        .upload(path, photo!, { contentType: photo!.type, upsert: false });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("attorney-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");

      const { error: insErr } = await supabase
        .from("attorney_submissions")
        .insert({
          full_name: form.full_name.trim(),
          title: form.title.trim(),
          specialty: form.specialty,
          location: form.location.trim(),
          description: form.description.trim(),
          photo_url: signed.signedUrl,
          status: "pending",
        });
      if (insErr) throw insErr;

      toast.success("Submitted! Your listing will show as Pending review.");
      reset();
      setOpen(false);
      onSubmitted?.();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const clearError = (k: keyof FieldErrors) => {
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const errorText = (msg?: string) =>
    msg ? <p className="text-xs font-medium text-destructive">{msg}</p> : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>List your practice</DialogTitle>
          <DialogDescription>
            All fields are required. New listings show as “Pending review” until verified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name <span className="text-destructive">*</span></Label>
            <Input
              id="full_name"
              maxLength={100}
              aria-invalid={!!errors.full_name}
              value={form.full_name}
              onChange={(e) => { setForm({ ...form, full_name: e.target.value }); clearError("full_name"); }}
            />
            {errorText(errors.full_name)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              maxLength={120}
              placeholder="e.g. Family Law Attorney"
              aria-invalid={!!errors.title}
              value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); clearError("title"); }}
            />
            {errorText(errors.title)}
          </div>
          <div className="space-y-2">
            <Label>Specialty <span className="text-destructive">*</span></Label>
            <Select
              value={form.specialty}
              onValueChange={(v) => { setForm({ ...form, specialty: v }); clearError("specialty"); }}
            >
              <SelectTrigger aria-invalid={!!errors.specialty}>
                <SelectValue placeholder="Choose one" />
              </SelectTrigger>
              <SelectContent>
                {specialties.filter((s) => s !== "All").map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorText(errors.specialty)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location <span className="text-destructive">*</span></Label>
            <Input
              id="location"
              maxLength={120}
              placeholder="City, State"
              aria-invalid={!!errors.location}
              value={form.location}
              onChange={(e) => { setForm({ ...form, location: e.target.value }); clearError("location"); }}
            />
            {errorText(errors.location)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Short description <span className="text-destructive">*</span></Label>
            <Textarea
              id="description"
              maxLength={400}
              rows={3}
              aria-invalid={!!errors.description}
              value={form.description}
              onChange={(e) => { setForm({ ...form, description: e.target.value }); clearError("description"); }}
            />
            {errorText(errors.description)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="photo">Profile photo <span className="text-destructive">*</span></Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              aria-invalid={!!errors.photo}
              onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); clearError("photo"); }}
            />
            {photo && !errors.photo && (
              <p className="text-xs text-muted-foreground">Selected: {photo.name}</p>
            )}
            {errorText(errors.photo)}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Submit listing
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
